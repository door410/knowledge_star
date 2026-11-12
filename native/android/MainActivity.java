package tw.door410.knowledgestar;

import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

// 建置時由 scripts/ci/android.sh 複製到 android/app/src/main/java/tw/door410/knowledgestar/（以 native/android/ 為準）
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GoogleDrivePlugin.class);
        super.onCreate(savedInstanceState);
        // 畫面不要被狀態列、導覽列、鍵盤擋住：把網頁往內縮到安全範圍
        View web = getBridge().getWebView();
        getWindow().getDecorView().setBackgroundColor(0xFF000000);
        ViewCompat.setOnApplyWindowInsetsListener(web, (v, insets) -> {
            Insets b = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.ime());
            ViewGroup.MarginLayoutParams lp = (ViewGroup.MarginLayoutParams) v.getLayoutParams();
            if (lp.leftMargin != b.left || lp.topMargin != b.top || lp.rightMargin != b.right || lp.bottomMargin != b.bottom) {
                lp.setMargins(b.left, b.top, b.right, b.bottom);
                v.setLayoutParams(lp);
            }
            return WindowInsetsCompat.CONSUMED;
        });
    }
}
