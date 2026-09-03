package com.docuswift.app;

import android.content.Intent;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "JetpackPdf")
public class JetpackPdfPlugin extends Plugin {

    @PluginMethod
    public void openPdf(PluginCall call) {
        String uri = call.getString("uri");
        if (uri == null) {
            call.reject("Must provide a uri");
            return;
        }

        Intent intent = new Intent(getContext(), PdfActivity.class);
        intent.putExtra("uri", uri);
        
        // Use startActivityForResult so we could theoretically handle a save callback
        getActivity().startActivityForResult(intent, 1001);
        call.resolve();
    }
}
