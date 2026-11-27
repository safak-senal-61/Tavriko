package expo.modules.tavrikoplayupdates

import android.app.Activity
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallException
import com.google.android.play.core.install.InstallState
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.ActivityResult
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallErrorCode
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability
import com.google.android.play.core.ktx.requestAppUpdateInfo
import com.google.android.play.core.ktx.requestCompleteUpdate
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.coroutines.cancellation.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/*
 * Google Play In-App Updates (Play Core app-update 2.1.0) için Expo modülü.
 *
 * expo-in-app-updates 0.13.0 (MIT) temel alındı. Farklar:
 *  - FLEXIBLE indirme bittiğinde uygulama KENDİLİĞİNDEN yeniden başlatılmaz.
 *    Google'ın önerdiği gibi JS tarafı kullanıcıya "Yeniden başlat" sorar ve
 *    `completeUpdate()` çağırır; böylece süren bir maç yarıda kesilmez.
 *  - İndirme ilerlemesi ve hata kodları JS'e olay olarak iletilir.
 *  - Hata durumunda mağazaya otomatik yönlendirme yapılmaz; karar JS'tedir.
 */

private const val REQUEST_CODE = 4127

private const val EVENT_STATUS = "onInstallStatus"
private const val EVENT_FLOW_RESULT = "onFlowResult"

private class PlayUpdateException(code: Int, cause: Throwable?) :
  CodedException("E_PLAY_UPDATE_${errorName(code)}", "Google Play update error ($code): ${cause?.message ?: ""}", cause)

private fun errorName(code: Int): String = when (code) {
  InstallErrorCode.ERROR_API_NOT_AVAILABLE -> "API_NOT_AVAILABLE"
  InstallErrorCode.ERROR_APP_NOT_OWNED -> "APP_NOT_OWNED"
  InstallErrorCode.ERROR_PLAY_STORE_NOT_FOUND -> "PLAY_STORE_NOT_FOUND"
  InstallErrorCode.ERROR_INSTALL_NOT_ALLOWED -> "INSTALL_NOT_ALLOWED"
  InstallErrorCode.ERROR_INSTALL_UNAVAILABLE -> "INSTALL_UNAVAILABLE"
  InstallErrorCode.ERROR_INSTALL_IN_PROGRESS -> "INSTALL_IN_PROGRESS"
  InstallErrorCode.ERROR_DOWNLOAD_NOT_PRESENT -> "DOWNLOAD_NOT_PRESENT"
  InstallErrorCode.ERROR_INVALID_REQUEST -> "INVALID_REQUEST"
  InstallErrorCode.ERROR_INTERNAL_ERROR -> "INTERNAL_ERROR"
  else -> "UNKNOWN"
}

private fun statusName(status: Int): String = when (status) {
  InstallStatus.PENDING -> "pending"
  InstallStatus.DOWNLOADING -> "downloading"
  InstallStatus.DOWNLOADED -> "downloaded"
  InstallStatus.INSTALLING -> "installing"
  InstallStatus.INSTALLED -> "installed"
  InstallStatus.FAILED -> "failed"
  InstallStatus.CANCELED -> "canceled"
  else -> "unknown"
}

class TavrikoPlayUpdatesModule : Module() {
  private val appUpdateManager: AppUpdateManager by lazy {
    AppUpdateManagerFactory.create(appContext.reactContext ?: throw Exceptions.ReactContextLost())
  }

  private val installStateListener = InstallStateUpdatedListener { state: InstallState ->
    sendEvent(
      EVENT_STATUS,
      mapOf(
        "status" to statusName(state.installStatus()),
        "bytesDownloaded" to state.bytesDownloaded().toDouble(),
        "totalBytesToDownload" to state.totalBytesToDownload().toDouble(),
        "errorCode" to state.installErrorCode()
      )
    )
  }

  override fun definition() = ModuleDefinition {
    Name("TavrikoPlayUpdates")

    Events(EVENT_STATUS, EVENT_FLOW_RESULT)

    OnCreate {
      runCatching { appUpdateManager.registerListener(installStateListener) }
    }

    OnDestroy {
      runCatching { appUpdateManager.unregisterListener(installStateListener) }
    }

    AsyncFunction("checkForUpdate") Coroutine { ->
      val info = requestInfo()
      val availability = info.updateAvailability()
      mapOf(
        "updateAvailable" to (availability == UpdateAvailability.UPDATE_AVAILABLE),
        "immediateInProgress" to (availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS),
        "immediateAllowed" to info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE),
        "flexibleAllowed" to info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE),
        "availableVersionCode" to info.availableVersionCode(),
        "stalenessDays" to info.clientVersionStalenessDays(),
        "priority" to info.updatePriority(),
        "installStatus" to statusName(info.installStatus()),
        "bytesDownloaded" to info.bytesDownloaded().toDouble(),
        "totalBytesToDownload" to info.totalBytesToDownload().toDouble()
      )
    }

    /** type: 0 = FLEXIBLE, 1 = IMMEDIATE. Akış başladıysa true döner. */
    AsyncFunction("startUpdate") Coroutine { type: Int ->
      val info = requestInfo()
      val availability = info.updateAvailability()
      val updateType = when {
        // Yarıda kalan IMMEDIATE güncelleme: Google bunun sürdürülmesini ister.
        availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS -> AppUpdateType.IMMEDIATE
        availability == UpdateAvailability.UPDATE_AVAILABLE && info.isUpdateTypeAllowed(type) -> type
        else -> return@Coroutine false
      }
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      val options = AppUpdateOptions.newBuilder(updateType).build()
      try {
        withContext(Dispatchers.Main) {
          appUpdateManager.startUpdateFlowForResult(info, activity, options, REQUEST_CODE)
        }
      } catch (e: CancellationException) {
        throw e
      } catch (e: InstallException) {
        throw PlayUpdateException(e.errorCode, e)
      } catch (e: Exception) {
        throw PlayUpdateException(InstallErrorCode.ERROR_UNKNOWN, e)
      }
    }

    /** FLEXIBLE indirme tamamlandıysa kurulumu başlatır; Play uygulamayı yeniden başlatır. */
    AsyncFunction("completeUpdate") Coroutine { ->
      try {
        appUpdateManager.requestCompleteUpdate()
        true
      } catch (e: CancellationException) {
        throw e
      } catch (e: InstallException) {
        throw PlayUpdateException(e.errorCode, e)
      } catch (e: Exception) {
        throw PlayUpdateException(InstallErrorCode.ERROR_UNKNOWN, e)
      }
    }

    OnActivityResult { _, result ->
      if (result.requestCode != REQUEST_CODE) return@OnActivityResult
      val outcome = when (result.resultCode) {
        Activity.RESULT_OK -> "accepted"
        Activity.RESULT_CANCELED -> "canceled"
        ActivityResult.RESULT_IN_APP_UPDATE_FAILED -> "failed"
        else -> "failed"
      }
      sendEvent(EVENT_FLOW_RESULT, mapOf("result" to outcome))
    }
  }

  private suspend fun requestInfo(): AppUpdateInfo =
    try {
      appUpdateManager.requestAppUpdateInfo()
    } catch (e: CancellationException) {
      throw e
    } catch (e: InstallException) {
      throw PlayUpdateException(e.errorCode, e)
    } catch (e: Exception) {
      throw PlayUpdateException(InstallErrorCode.ERROR_UNKNOWN, e)
    }
}
