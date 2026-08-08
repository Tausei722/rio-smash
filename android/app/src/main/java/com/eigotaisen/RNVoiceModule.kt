package com.eigotaisen

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class RNVoiceModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var speechRecognizer: SpeechRecognizer? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun getName() = "RNVoice"

    @ReactMethod
    fun start(locale: String, promise: Promise) {
        mainHandler.post {
            try {
                if (!SpeechRecognizer.isRecognitionAvailable(reactContext)) {
                    promise.reject("NOT_AVAILABLE", "この端末では音声認識が利用できません")
                    return@post
                }

                speechRecognizer?.destroy()
                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(reactContext)
                speechRecognizer?.setRecognitionListener(object : RecognitionListener {
                    override fun onReadyForSpeech(p: Bundle?) {}
                    override fun onBeginningOfSpeech() {}
                    override fun onRmsChanged(p: Float) {}
                    override fun onBufferReceived(p: ByteArray?) {}
                    override fun onEvent(p: Int, p1: Bundle?) {}

                    override fun onPartialResults(partialResults: Bundle) {
                        val text = partialResults
                            .getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                            ?.firstOrNull() ?: ""
                        sendEvent("RNVoice.onSpeechPartialResults", text)
                    }

                    override fun onResults(results: Bundle) {
                        val text = results
                            .getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                            ?.firstOrNull() ?: ""
                        sendEvent("RNVoice.onSpeechResults", text)
                        sendEvent("RNVoice.onSpeechEnd", "")
                    }

                    override fun onEndOfSpeech() {
                        sendEvent("RNVoice.onSpeechEnd", "")
                    }

                    override fun onError(error: Int) {
                        if (error == SpeechRecognizer.ERROR_NO_MATCH ||
                            error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
                            sendEvent("RNVoice.onSpeechEnd", "")
                        } else {
                            sendEvent("RNVoice.onSpeechError", error.toString())
                        }
                    }
                })

                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale)
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                    putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                }

                speechRecognizer?.startListening(intent)
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("START_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        mainHandler.post {
            speechRecognizer?.stopListening()
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun cancel(promise: Promise) {
        mainHandler.post {
            speechRecognizer?.cancel()
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun destroy(promise: Promise) {
        mainHandler.post {
            speechRecognizer?.destroy()
            speechRecognizer = null
            promise.resolve(null)
        }
    }

    private fun sendEvent(eventName: String, data: String) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, data)
    }

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}
}
