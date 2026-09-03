package com.docuswift.app;

import android.net.Uri;
import android.os.Bundle;
import android.view.MenuItem;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.fragment.app.FragmentManager;
import androidx.pdf.viewer.fragment.PdfViewerFragment;

public class PdfActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_pdf);

        Toolbar toolbar = findViewById(R.id.toolbar);
        setSupportActionBar(toolbar);
        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
            getSupportActionBar().setDisplayShowHomeEnabled(true);
            getSupportActionBar().setTitle("DocuSwift Jetpack");
        }

        String uriString = getIntent().getStringExtra("uri");
        if (uriString != null) {
            Uri uri = Uri.parse(uriString);
            
            FragmentManager fragmentManager = getSupportFragmentManager();
            
            PdfViewerFragment pdfViewerFragment;
            try {
                Class<?> editableClass = Class.forName("androidx.pdf.viewer.fragment.EditablePdfViewerFragment");
                pdfViewerFragment = (PdfViewerFragment) editableClass.newInstance();
            } catch (Exception e) {
                // Fallback to standard viewer if Editable is stripped or renamed
                pdfViewerFragment = new PdfViewerFragment();
            }
            
            fragmentManager.beginTransaction()
                    .replace(R.id.fragment_container, pdfViewerFragment)
                    .commit();
                    
            pdfViewerFragment.setDocumentUri(uri);
        }
    }

    @Override
    public boolean onOptionsItemSelected(@NonNull MenuItem item) {
        if (item.getItemId() == android.R.id.home) {
            setResult(RESULT_OK);
            finish();
            return true;
        }
        return super.onOptionsItemSelected(item);
    }
}
