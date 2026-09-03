package com.docuswift.app;

import android.net.Uri;
import android.os.Bundle;
import android.view.Menu;
import android.view.MenuItem;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.fragment.app.FragmentManager;
import androidx.pdf.viewer.fragment.PdfViewerFragment;
import java.lang.reflect.Method;

public class PdfActivity extends AppCompatActivity {
    private PdfViewerFragment pdfViewerFragment;
    private boolean isSearchActive = false;

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
            
            try {
                Class<?> editableClass = Class.forName("androidx.pdf.viewer.fragment.EditablePdfViewerFragment");
                pdfViewerFragment = (PdfViewerFragment) editableClass.newInstance();
            } catch (Exception e) {
                pdfViewerFragment = new PdfViewerFragment();
            }
            
            fragmentManager.beginTransaction()
                    .replace(R.id.fragment_container, pdfViewerFragment)
                    .commit();
                    
            pdfViewerFragment.setDocumentUri(uri);
        }
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        // Add a search icon
        MenuItem searchItem = menu.add(Menu.NONE, 101, Menu.NONE, "Search");
        searchItem.setIcon(android.R.drawable.ic_menu_search);
        searchItem.setShowAsAction(MenuItem.SHOW_AS_ACTION_ALWAYS);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(@NonNull MenuItem item) {
        if (item.getItemId() == android.R.id.home) {
            setResult(RESULT_OK);
            finish();
            return true;
        } else if (item.getItemId() == 101) {
            // Toggle search
            isSearchActive = !isSearchActive;
            try {
                Method setTextSearchActive = pdfViewerFragment.getClass().getMethod("setTextSearchActive", boolean.class);
                setTextSearchActive.invoke(pdfViewerFragment, isSearchActive);
            } catch (Exception e) {
                // Ignore if method not found in older beta
            }
            return true;
        }
        return super.onOptionsItemSelected(item);
    }
}
