import java.util.Properties

plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

val releaseSigningDir = rootProject.file("signing")
val releaseSigningPropsFile = releaseSigningDir.resolve("release.properties")
val releaseSigningProps = Properties().apply {
  if (releaseSigningPropsFile.exists()) {
    releaseSigningPropsFile.inputStream().use { load(it) }
  }
}

fun readSigningValue(propertyKey: String, envKey: String): String? {
  val propertyValue = releaseSigningProps.getProperty(propertyKey)?.trim().orEmpty()
  if (propertyValue.isNotEmpty()) {
    return propertyValue
  }

  val envValue = System.getenv(envKey)?.trim().orEmpty()
  return envValue.ifEmpty { null }
}

val releaseStoreFilePath = readSigningValue("storeFile", "TODO_ANDROID_STORE_FILE")
val releaseStorePassword = readSigningValue("storePassword", "TODO_ANDROID_STORE_PASSWORD")
val releaseKeyAlias = readSigningValue("keyAlias", "TODO_ANDROID_KEY_ALIAS")
val releaseKeyPassword = readSigningValue("keyPassword", "TODO_ANDROID_KEY_PASSWORD")
val hasReleaseSigning = listOf(
  releaseStoreFilePath,
  releaseStorePassword,
  releaseKeyAlias,
  releaseKeyPassword
).all { !it.isNullOrBlank() }

android {
  namespace = "com.pushm.todolist.android"
  compileSdk = 35

  defaultConfig {
    applicationId = "com.pushm.todolist.android"
    minSdk = 26
    targetSdk = 35
    versionCode = 2
    versionName = "1.1.0"

    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
  }

  signingConfigs {
    if (hasReleaseSigning) {
      create("release") {
        storeFile = file(releaseStoreFilePath!!)
        storePassword = releaseStorePassword
        keyAlias = releaseKeyAlias
        keyPassword = releaseKeyPassword
      }
    }
  }

  buildTypes {
    release {
      isMinifyEnabled = false
      if (hasReleaseSigning) {
        signingConfig = signingConfigs.getByName("release")
      }
      proguardFiles(
        getDefaultProguardFile("proguard-android-optimize.txt"),
        "proguard-rules.pro"
      )
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  kotlinOptions {
    jvmTarget = "17"
  }

  buildFeatures {
    viewBinding = true
  }
}

dependencies {
  implementation("androidx.core:core-ktx:1.13.1")
  implementation("androidx.appcompat:appcompat:1.7.0")
  implementation("com.google.android.material:material:1.12.0")
  implementation("androidx.activity:activity-ktx:1.9.2")
  implementation("androidx.webkit:webkit:1.11.0")
  implementation("androidx.work:work-runtime-ktx:2.9.1")
  implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
}
