plugins {
    application
}

repositories {
    mavenCentral()
    maven("https://repo.runelite.net")
}

// latest.release so a cache-format fix in RuneLite is picked up without a commit here.
// The resolved version is recorded in manifest.json (see the cacheVersion task).
val runeliteCache = "net.runelite:cache:latest.release"

dependencies {
    implementation(runeliteCache)
    implementation("com.google.code.gson:gson:2.13.2")
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

application {
    mainClass = "net.runelite.cache.IconDump"
    applicationDefaultJvmArgs = listOf("-Xmx4g", "-Djava.awt.headless=true")
}

tasks.register("cacheVersion") {
    val artifacts = configurations.runtimeClasspath.get().incoming.resolutionResult.rootComponent
    doLast {
        val version = artifacts.get().dependencies
            .filterIsInstance<org.gradle.api.artifacts.result.ResolvedDependencyResult>()
            .map { it.selected.moduleVersion }
            .first { it?.group == "net.runelite" && it.name == "cache" }!!
            .version
        println("runelite-cache=$version")
    }
}
