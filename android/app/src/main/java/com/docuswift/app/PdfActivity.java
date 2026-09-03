package com.docuswift.app;

import android.net.Uri;
import android.os.Bundle;
import android.view.MenuItem;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.fragment.app.FragmentManager;
import androidx.pdf.viewer.fragment.PdfViewerFragment;

public class PdfActivity extends AppCompatActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_pdf);

        Toolbar toolbar = findViewById(R.id.pdf_toolbar);
        setSupportActionBar(toolbar);
        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
            getSupportActionBar().setTitle("DocuSwift Viewer");
        }

        String uriString = getIntent().getStringExtra("pdfUri");
        if (uriString != null) {
            Uri pdfUri = Uri.parse(uriString);
            FragmentManager fm = getSupportFragmentManager();
            PdfViewerFragment pdfFragment = (PdfViewerFragment) fm.findFragmentById(R.id.pdf_container);
            if (pdfFragment != null) {
                pdfFragment.setDocumentUri(pdfUri);
            }
        }
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        if (item.getItemId() == android.R.id.home) {
            finish();
            return true;
        }
        return super.onOptionsItemSelected(item);
    }
}
