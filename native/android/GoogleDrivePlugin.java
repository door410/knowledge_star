package tw.door410.knowledgestar;

import android.accounts.Account;
import android.accounts.AccountManager;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationClient;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.AccountPicker;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.Scope;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

/**
 * Google 雲端硬碟（只要求 drive.file）：
 * - chooseAccount：每次「連接」都顯示 Google 帳號選擇（中斷連接後可改選其他帳號），選定的帳號存在本機
 * - authorize：用選定的帳號取得存取權杖（之後同步時不顯示畫面）
 * - request：同步用 HTTP 由原生程式送出（避開 WebView 跨來源限制）；只允許 googleapis.com
 * Google 依「套件名稱＋簽章 SHA-1」辨識本 App，程式內不需要用戶端 ID。
 * 由 native/android/ 在建置時複製到 android/app/src/main/java/tw/door410/knowledgestar/（以此處為準）
 */
@CapacitorPlugin(name = "GoogleDrive")
public class GoogleDrivePlugin extends Plugin {
    private static final String DRIVE_FILE = "https://www.googleapis.com/auth/drive.file";
    private static final String PREFS = "google_drive";
    private ActivityResultLauncher<IntentSenderRequest> launcher;
    private ActivityResultLauncher<Intent> picker;
    private PluginCall pending;
    private PluginCall pendingPick;
    private final ExecutorService pool = Executors.newFixedThreadPool(3);

    @Override
    public void load() {
        launcher = getActivity().registerForActivityResult(
            new ActivityResultContracts.StartIntentSenderForResult(), this::onResult);
        picker = getActivity().registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(), this::onPicked);
    }

    private AuthorizationClient client() {
        return Identity.getAuthorizationClient(getActivity());
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private String savedAccount() {
        return prefs().getString("account", null);
    }

    @PluginMethod
    public void chooseAccount(final PluginCall call) {
        Intent i = AccountPicker.newChooseAccountIntent(
            new AccountPicker.AccountChooserOptions.Builder()
                .setAllowableAccountsTypes(Collections.singletonList("com.google"))
                .setAlwaysShowAccountPicker(true)
                .build());
        if (pendingPick != null) pendingPick.reject("已重新開啟帳號選擇", "CANCELED");
        pendingPick = call;
        try {
            picker.launch(i);
        } catch (Exception e) {
            pendingPick = null;
            call.reject("無法開啟 Google 帳號選擇：" + e.getMessage(), "AUTH_FAILED");
        }
    }

    private void onPicked(ActivityResult r) {
        PluginCall call = pendingPick;
        pendingPick = null;
        if (call == null) return;
        String name = r.getData() == null ? null : r.getData().getStringExtra(AccountManager.KEY_ACCOUNT_NAME);
        if (r.getResultCode() != Activity.RESULT_OK || name == null) {
            call.reject("已取消選擇帳號", "CANCELED");
            return;
        }
        prefs().edit().putString("account", name).apply();
        JSObject o = new JSObject();
        o.put("email", name);
        call.resolve(o);
    }

    @PluginMethod
    public void forget(final PluginCall call) {
        prefs().edit().remove("account").apply();
        call.resolve();
    }

    @PluginMethod
    public void authorize(final PluginCall call) {
        final boolean interactive = Boolean.TRUE.equals(call.getBoolean("interactive", false));
        AuthorizationRequest.Builder b = AuthorizationRequest.builder()
            .setRequestedScopes(Collections.singletonList(new Scope(DRIVE_FILE)));
        String acc = savedAccount();
        if (acc != null) b.setAccount(new Account(acc, "com.google"));
        client().authorize(b.build())
            .addOnSuccessListener(result -> {
                if (result.hasResolution()) {
                    PendingIntent pi = result.getPendingIntent();
                    if (!interactive || pi == null) {
                        call.reject("需要登入 Google", "NEED_SIGN_IN");
                        return;
                    }
                    if (pending != null) pending.reject("已重新開啟登入畫面", "CANCELED");
                    pending = call;
                    try {
                        launcher.launch(new IntentSenderRequest.Builder(pi.getIntentSender()).build());
                    } catch (Exception e) {
                        pending = null;
                        call.reject("無法開啟 Google 登入畫面：" + e.getMessage(), "AUTH_FAILED");
                    }
                } else {
                    done(call, result);
                }
            })
            .addOnFailureListener(e -> call.reject("Google 授權失敗：" + e.getMessage(), "AUTH_FAILED"));
    }

    private void onResult(ActivityResult r) {
        PluginCall call = pending;
        pending = null;
        if (call == null) return;
        if (r.getResultCode() != Activity.RESULT_OK || r.getData() == null) {
            call.reject("已取消 Google 登入", "CANCELED");
            return;
        }
        try {
            done(call, client().getAuthorizationResultFromIntent(r.getData()));
        } catch (ApiException e) {
            call.reject("Google 授權失敗（代碼 " + e.getStatusCode() + "）", "AUTH_FAILED");
        }
    }

    private void done(PluginCall call, AuthorizationResult result) {
        String token = result.getAccessToken();
        if (token == null) {
            call.reject("沒有取得 Google 存取權杖", "AUTH_FAILED");
            return;
        }
        JSObject o = new JSObject();
        o.put("accessToken", token);
        String acc = savedAccount();
        if (acc != null) o.put("email", acc);
        call.resolve(o);
    }

    /** 同步用 HTTP：{ method, url, headers, body（base64，可省略） } → { status, headers, body（base64） } */
    @PluginMethod
    public void request(final PluginCall call) {
        final String method = call.getString("method", "GET");
        final String url = call.getString("url", "");
        final JSObject headers = call.getObject("headers", new JSObject());
        final String body = call.getString("body", null);
        if (!url.startsWith("https://www.googleapis.com/") && !url.startsWith("https://oauth2.googleapis.com/")) {
            call.reject("不允許的網址", "BAD_URL");
            return;
        }
        pool.execute(() -> {
            HttpURLConnection c = null;
            try {
                c = (HttpURLConnection) new URL(url).openConnection();
                c.setRequestMethod(method);
                c.setConnectTimeout(30000);
                c.setReadTimeout(120000);
                c.setUseCaches(false);
                Iterator<String> keys = headers.keys();
                while (keys.hasNext()) {
                    String k = keys.next();
                    c.setRequestProperty(k, headers.getString(k));
                }
                if (body != null) {
                    byte[] data = Base64.decode(body, Base64.NO_WRAP);
                    c.setDoOutput(true);
                    c.setFixedLengthStreamingMode(data.length);
                    try (OutputStream os = c.getOutputStream()) { os.write(data); }
                }
                int status = c.getResponseCode();
                InputStream in = status >= 400 ? c.getErrorStream() : c.getInputStream();
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                if (in != null) {
                    try (InputStream s = in) {
                        byte[] buf = new byte[65536];
                        int n;
                        while ((n = s.read(buf)) > 0) out.write(buf, 0, n);
                    }
                }
                JSONObject h = new JSONObject();
                for (Map.Entry<String, List<String>> e : c.getHeaderFields().entrySet()) {
                    if (e.getKey() == null || e.getValue() == null || e.getValue().isEmpty()) continue;
                    h.put(e.getKey().toLowerCase(java.util.Locale.ROOT), e.getValue().get(0));
                }
                JSObject o = new JSObject();
                o.put("status", status);
                o.put("headers", h);
                o.put("body", Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
                call.resolve(o);
            } catch (Exception e) {
                call.reject(e.getClass().getSimpleName() + ": " + e.getMessage(), "NETWORK");
            } finally {
                if (c != null) c.disconnect();
            }
        });
    }
}
