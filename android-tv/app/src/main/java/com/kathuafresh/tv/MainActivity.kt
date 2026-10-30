package com.kathuafresh.tv

import android.annotation.SuppressLint
import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.content.Intent
import android.net.Uri
import android.speech.tts.TextToSpeech
import android.view.View
import android.view.WindowManager
import android.webkit.*
import android.widget.ProgressBar
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import java.util.Locale

class MainActivity : AppCompatActivity(), TextToSpeech.OnInitListener {

    private lateinit var webView: WebView
    private lateinit var loadingSpinner: ProgressBar
    private var tts: TextToSpeech? = null
    private var ttsReady = false

    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private val FILE_CHOOSER_REQUEST_CODE = 2001

    // Primary Live TV Screen URL
    private val TV_URL = "https://tv-app-5wzh.vercel.app/tv?preview=true"

    private var backPressTime: Long = 0

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 1. Keep TV Screen Always Awake (No sleep/screensaver)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // 2. Hide Navigation & Status Bars (Fullscreen Immersive Mode)
        hideSystemUI()

        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        loadingSpinner = findViewById(R.id.loadingSpinner)

        // 3. Initialize Android TextToSpeech engine
        tts = TextToSpeech(this, this)

        // 4. Configure Fullscreen Hardware-Accelerated WebView
        setupWebView()

        // 5. Setup Network Liveness Monitor
        setupNetworkCallback()

        // 6. Load Live Kathua Fresh Signage Display
        webView.loadUrl(TV_URL)
    }

    private fun hideSystemUI() {
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_FULLSCREEN
        )
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            hideSystemUI()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true

        // Allow media (audio announcements & background music) to autoplay without remote click
        settings.mediaPlaybackRequiresUserGesture = false

        // Cache settings for resilience against temporary WiFi cuts
        settings.cacheMode = WebSettings.LOAD_DEFAULT

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }

        // Bridge for window.AndroidSignage.speak(text, lang)
        webView.addJavascriptInterface(SignageJsBridge(), "AndroidSignage")

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                loadingSpinner.visibility = View.GONE
            }

            override fun onReceivedError(
                view: WebView?,
                errorCode: Int,
                description: String?,
                failingUrl: String?
            ) {
                // If offline or connection dropped, retry after 5 seconds
                Handler(Looper.getMainLooper()).postDelayed({
                    webView.reload()
                }, 5000)
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress < 100) {
                    loadingSpinner.visibility = View.VISIBLE
                } else {
                    loadingSpinner.visibility = View.GONE
                }
            }

            override fun onShowFileChooser(
                view: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                // Cancel existing callback if any to prevent webview hanging
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = filePathCallback

                try {
                    val pickIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "image/*"
                    }
                    val chooserIntent = Intent(Intent.ACTION_CHOOSER).apply {
                        putExtra(Intent.EXTRA_INTENT, pickIntent)
                        putExtra(Intent.EXTRA_TITLE, "Select Offer Photo")
                    }
                    startActivityForResult(chooserIntent, FILE_CHOOSER_REQUEST_CODE)
                    return true
                } catch (e: Exception) {
                    fileUploadCallback?.onReceiveValue(null)
                    fileUploadCallback = null
                    return false
                }
            }
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (fileUploadCallback == null) return
            val results: Array<Uri>? = if (resultCode == RESULT_OK && data != null) {
                data.data?.let { arrayOf(it) }
                    ?: data.clipData?.let { clip ->
                        Array(clip.itemCount) { i -> clip.getItemAt(i).uri }
                    }
            } else {
                null
            }
            fileUploadCallback?.onReceiveValue(results)
            fileUploadCallback = null
        }
    }

    private fun setupNetworkCallback() {
        try {
            val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                cm.registerDefaultNetworkCallback(object : ConnectivityManager.NetworkCallback() {
                    override fun onAvailable(network: Network) {
                        runOnUiThread {
                            // If webview was disconnected, reload automatically
                            if (webView.url == null || webView.url.isNullOrEmpty()) {
                                webView.loadUrl(TV_URL)
                            }
                        }
                    }
                })
            }
        } catch (e: Exception) {
            // Ignore callback registration failures on older Android TV ROMs
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            val result = tts?.setLanguage(Locale("hi", "IN"))
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                tts?.setLanguage(Locale.ENGLISH)
            }
            ttsReady = true
        }
    }

    /**
     * JavaScript Bridge interface exposed to Next.js page via window.AndroidSignage
     */
    inner class SignageJsBridge {
        @JavascriptInterface
        fun speak(text: String, lang: String) {
            if (!ttsReady || tts == null) return
            try {
                if (lang.lowercase().startsWith("hi")) {
                    tts?.language = Locale("hi", "IN")
                } else {
                    tts?.language = Locale.ENGLISH
                }
                tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "signage-announcement")
            } catch (e: Exception) {
                // Ignore speech error
            }
        }

        @JavascriptInterface
        fun getAppVersion(): String {
            return "1.0.0-kathua-fresh"
        }
    }

    override fun onBackPressed() {
        // Prevent accidental exit on remote control back press
        if (backPressTime + 2000 > System.currentTimeMillis()) {
            super.onBackPressed()
        } else {
            Toast.makeText(this, "Press BACK again to exit Kathua Fresh TV", Toast.LENGTH_SHORT).show()
            backPressTime = System.currentTimeMillis()
        }
    }

    override fun onDestroy() {
        tts?.stop()
        tts?.shutdown()
        super.onDestroy()
    }
}
