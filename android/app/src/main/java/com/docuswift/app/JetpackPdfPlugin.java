package com.docuswift.app;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "JetpackPdf")
public class JetpackPdfPlugin extends Plugin {

    @PluginMethod
    public void openPdf(PluginCall call) {
        String uriStr = call.getString("uri");
        if (uriStr == null) {
            call.reject("Must provide uri");
            return;
        }

        Intent intent = new Intent(getContext(), PdfActivity.class);
        intent.putExtra("pdfUri", uriStr);
        getContext().startActivity(intent);
        call.resolve();
    }
}
