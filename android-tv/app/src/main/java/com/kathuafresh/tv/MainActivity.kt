package com.kathuafresh.tv

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.Network
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.speech.tts.TextToSpeech
import android.view.View
import android.view.WindowManager
import android.webkit.*
import android.widget.ProgressBar
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream
import java.util.Locale

class MainActivity : AppCompatActivity(), TextToSpeech.OnInitListener {

    private lateinit var webView: WebView
    private lateinit var loadingSpinner: ProgressBar
    private var tts: TextToSpeech? = null
    private var ttsReady = false

    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private val FILE_CHOOSER_REQUEST_CODE = 2001
    private val PERMISSION_REQUEST_CODE = 3001

    // Mode URLs: User / TV Screen Mode and Admin Management Mode
    private val TV_URL = "https://tv-app-5wzh.vercel.app/tv"
    private val ADMIN_URL = "https://tv-app-5wzh.vercel.app/admin/signage"

    private fun getSavedMode(): String {
        return getSharedPreferences("kathua_tv_prefs", Context.MODE_PRIVATE)
            .getString("app_mode", "tv") ?: "tv"
    }

    private fun setSavedMode(mode: String) {
        getSharedPreferences("kathua_tv_prefs", Context.MODE_PRIVATE)
            .edit().putString("app_mode", mode).apply()
    }

    private fun getTargetUrlForMode(mode: String): String {
        return if (mode.lowercase() == "admin") ADMIN_URL else TV_URL
    }

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

        // 3. Request permissions for Camera and Storage
        checkAppPermissions()

        // 4. Initialize Android TextToSpeech engine
        tts = TextToSpeech(this, this)

        // 5. Configure Fullscreen Hardware-Accelerated WebView
        setupWebView()

        // 6. Setup Network Liveness Monitor
        setupNetworkCallback()

        // 7. Load Kathua Fresh Display based on current mode (defaults to User TV mode)
        val mode = getSavedMode()
        webView.loadUrl(getTargetUrlForMode(mode))
    }

    private fun checkAppPermissions() {
        val permissionsToRequest = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(android.Manifest.permission.CAMERA)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.READ_MEDIA_IMAGES) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(android.Manifest.permission.READ_MEDIA_IMAGES)
            }
        } else {
            if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(android.Manifest.permission.READ_EXTERNAL_STORAGE)
            }
        }
        if (permissionsToRequest.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, permissionsToRequest.toTypedArray(), PERMISSION_REQUEST_CODE)
        }
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
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = filePathCallback

                try {
                    val chooserIntent = buildImageChooserIntent(fileChooserParams)
                    startActivityForResult(chooserIntent, FILE_CHOOSER_REQUEST_CODE)
                    return true
                } catch (e: Exception) {
                    try {
                        // Fallback: direct gallery picker
                        val galleryIntent = Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI).apply {
                            type = "image/*"
                        }
                        startActivityForResult(galleryIntent, FILE_CHOOSER_REQUEST_CODE)
                        return true
                    } catch (e2: Exception) {
                        fileUploadCallback?.onReceiveValue(null)
                        fileUploadCallback = null
                        return false
                    }
                }
            }
        }
    }

    private fun buildImageChooserIntent(fileChooserParams: WebChromeClient.FileChooserParams?): Intent {
        val extraIntents = mutableListOf<Intent>()

        // 1. Camera option
        val cameraIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
        if (cameraIntent.resolveActivity(packageManager) != null) {
            extraIntents.add(cameraIntent)
        }

        // 2. Base content picker intent
        var baseIntent = fileChooserParams?.createIntent()
        if (baseIntent == null) {
            baseIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "image/*"
            }
        }

        // 3. Fallback gallery intent if supported
        val galleryIntent = Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI).apply {
            type = "image/*"
        }
        if (galleryIntent.resolveActivity(packageManager) != null) {
            extraIntents.add(galleryIntent)
        }

        val chooserIntent = Intent(Intent.ACTION_CHOOSER).apply {
            putExtra(Intent.EXTRA_INTENT, baseIntent)
            putExtra(Intent.EXTRA_TITLE, "Select Offer Image")
            if (extraIntents.isNotEmpty()) {
                putExtra(Intent.EXTRA_INITIAL_INTENTS, extraIntents.toTypedArray())
            }
        }
        return chooserIntent
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (fileUploadCallback == null) return

            var results: Array<Uri>? = null
            if (resultCode == RESULT_OK) {
                if (data != null) {
                    if (data.data != null) {
                        results = arrayOf(data.data!!)
                    } else if (data.clipData != null) {
                        val count = data.clipData!!.itemCount
                        results = Array(count) { i -> data.clipData!!.getItemAt(i).uri }
                    } else if (data.extras?.get("data") is Bitmap) {
                        val bitmap = data.extras?.get("data") as Bitmap
                        saveBitmapToCache(bitmap)?.let {
                            results = arrayOf(it)
                        }
                    }
                }
            }

            fileUploadCallback?.onReceiveValue(results)
            fileUploadCallback = null
        }
    }

    private fun saveBitmapToCache(bitmap: Bitmap): Uri? {
        return try {
            val cachePath = File(cacheDir, "images")
            cachePath.mkdirs()
            val file = File(cachePath, "upload_${System.currentTimeMillis()}.jpg")
            val stream = FileOutputStream(file)
            bitmap.compress(Bitmap.CompressFormat.JPEG, 90, stream)
            stream.flush()
            stream.close()
            Uri.fromFile(file)
        } catch (e: Exception) {
            null
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

        @JavascriptInterface
        fun switchMode(mode: String) {
            runOnUiThread {
                val target = if (mode.lowercase().contains("admin")) "admin" else "tv"
                setSavedMode(target)
                val url = getTargetUrlForMode(target)
                Toast.makeText(
                    this@MainActivity,
                    if (target == "admin") "Switching to Admin Mode..." else "Switching to User TV Mode...",
                    Toast.LENGTH_SHORT
                ).show()
                webView.loadUrl(url)
            }
        }

        @JavascriptInterface
        fun getAppMode(): String {
            return getSavedMode()
        }

        @JavascriptInterface
        fun openImagePicker() {
            runOnUiThread {
                try {
                    val chooser = buildImageChooserIntent(null)
                    startActivityForResult(chooser, FILE_CHOOSER_REQUEST_CODE)
                } catch (e: Exception) {
                    Toast.makeText(this@MainActivity, "Opening Gallery...", Toast.LENGTH_SHORT).show()
                }
            }
        }

        @JavascriptInterface
        fun openCamera() {
            runOnUiThread {
                try {
                    val cameraIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
                    startActivityForResult(cameraIntent, FILE_CHOOSER_REQUEST_CODE)
                } catch (e: Exception) {
                    Toast.makeText(this@MainActivity, "Opening Camera...", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
            return
        }
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
