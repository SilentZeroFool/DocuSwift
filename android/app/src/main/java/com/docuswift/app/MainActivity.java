package com.docuswift.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(JetpackPdfPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
