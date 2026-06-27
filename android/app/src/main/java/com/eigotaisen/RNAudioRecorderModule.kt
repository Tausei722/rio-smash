package com.eigotaisen

import android.media.MediaPlayer
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import com.facebook.react.bridge.*

class RNAudioRecorderModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var mediaRecorder: MediaRecorder? = null
    private var mediaPlayer: MediaPlayer? = null
    private var currentOutputPath: String? = null

    override fun getName(): String = "RNAudioRecorder"

    @ReactMethod
    fun startRecording(path: String, promise: Promise) {
        try {
            mediaRecorder?.release()
            val recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(reactContext)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }
            recorder.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioSamplingRate(44100)
                setAudioEncodingBitRate(128000)
                setOutputFile(path)
                prepare()
                start()
            }
            mediaRecorder = recorder
            currentOutputPath = path
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("RECORD_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopRecording(promise: Promise) {
        val recorder = mediaRecorder
        val path = currentOutputPath
        if (recorder == null || path == null) {
            promise.reject("NO_RECORDER", "録音が開始されていません")
            return
        }
        try {
            recorder.stop()
            recorder.release()
            mediaRecorder = null
            currentOutputPath = null
            promise.resolve(path)
        } catch (e: Exception) {
            mediaRecorder = null
            currentOutputPath = null
            promise.reject("STOP_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun startPlayback(path: String, promise: Promise) {
        try {
            mediaPlayer?.release()
            mediaPlayer = MediaPlayer().apply {
                val uri = if (path.startsWith("file://")) {
                    Uri.parse(path)
                } else {
                    Uri.parse("file://$path")
                }
                setDataSource(reactContext, uri)
                prepare()
                start()
            }
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("PLAY_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopPlayback(promise: Promise) {
        try {
            mediaPlayer?.stop()
            mediaPlayer?.release()
            mediaPlayer = null
        } catch (_: Exception) {}
        promise.resolve(null)
    }
}
