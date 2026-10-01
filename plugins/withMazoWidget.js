/**
 * Expo Config Plugin for Mazo Home Screen Widget
 *
 * Registers the single unified MazoCoachWidget on Android.
 * Copies layout, metadata, Kotlin source, and drawable files.
 *
 * Usage: Add to app.json plugins: ["./plugins/withMazoWidget"]
 */

const fs = require('fs');
const path = require('path');
const {
    withInfoPlist,
    withAndroidManifest,
    withDangerousMod,
} = require('@expo/config-plugins');

const REQUIRED_ANDROID_WIDGET_FILES = [
    'widgets/android/mazo_widget.xml',
    'widgets/android/mazo_widget_info.xml',
    'widgets/android/MazoWidgetProvider.kt',
    'widgets/android/drawable/widget_bg.xml',
    'widgets/android/drawable/widget_pill_bg.xml',
];

function hasAndroidWidgetSources(projectRoot) {
    return REQUIRED_ANDROID_WIDGET_FILES.every((file) => fs.existsSync(path.join(projectRoot, file)));
}

/** iOS: Log setup reminder */
function withIosAppGroups(config) {
    return withInfoPlist(config, (config) => {
        return config;
    });
}

/** Android: Register the widget provider in AndroidManifest.xml */
function withAndroidWidget(config) {
    return withAndroidManifest(config, (config) => {
        const mainApplication = config.modResults.manifest.application?.[0];
        if (!mainApplication) {
            console.warn('[MazoWidget] Could not find main application in AndroidManifest.xml');
            return config;
        }

        if (!mainApplication.receiver) {
            mainApplication.receiver = [];
        }

        if (!hasAndroidWidgetSources(config.modRequest.projectRoot)) {
            // This checkout does not include the native widget source yet. Do
            // not register a receiver that references a missing Android XML.
            mainApplication.receiver = mainApplication.receiver.filter(
                (r) => r.$?.['android:name'] !== '.widget.MazoWidgetProvider'
            );
            console.warn('[MazoWidget] Native widget sources are absent; skipping widget registration.');
            return config;
        }

        // Only the unified MazoWidgetProvider
        const existing = mainApplication.receiver.find(
            (r) => r.$?.['android:name'] === '.widget.MazoWidgetProvider'
        );

        if (!existing) {
            mainApplication.receiver.push({
                $: {
                    'android:name': '.widget.MazoWidgetProvider',
                    'android:exported': 'true',
                },
                'intent-filter': [
                    {
                        action: [
                            { $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } },
                        ],
                    },
                ],
                'meta-data': [
                    {
                        $: {
                            'android:name': 'android.appwidget.provider',
                            'android:resource': '@xml/mazo_widget_info',
                        },
                    },
                ],
            });
        }

        // Remove old Schedule/Goals receivers if they exist from previous builds
        mainApplication.receiver = mainApplication.receiver.filter(
            (r) => !['.widget.ScheduleWidgetProvider', '.widget.GoalsWidgetProvider'].includes(r.$?.['android:name'])
        );

        return config;
    });
}

/** Android: Copy widget native files */
function withAndroidFiles(config) {
    return withDangerousMod(config, [
        'android',
        async (config) => {
            const projectRoot = config.modRequest.projectRoot;
            const androidRoot = config.modRequest.platformProjectRoot;

            if (!hasAndroidWidgetSources(projectRoot)) return config;

            const resPath = path.join(androidRoot, 'app/src/main/res');
            const layoutPath = path.join(resPath, 'layout');
            const xmlPath = path.join(resPath, 'xml');
            const drawablePath = path.join(resPath, 'drawable');
            const srcPath = path.join(androidRoot, 'app/src/main/java/app/mazo/ai/widget');

            fs.mkdirSync(layoutPath, { recursive: true });
            fs.mkdirSync(xmlPath, { recursive: true });
            fs.mkdirSync(drawablePath, { recursive: true });
            fs.mkdirSync(srcPath, { recursive: true });

            const filesToCopy = [
                // Unified widget
                { src: 'widgets/android/mazo_widget.xml', dest: path.join(layoutPath, 'mazo_widget.xml') },
                { src: 'widgets/android/mazo_widget_info.xml', dest: path.join(xmlPath, 'mazo_widget_info.xml') },
                { src: 'widgets/android/MazoWidgetProvider.kt', dest: path.join(srcPath, 'MazoWidgetProvider.kt') },
                // Drawables
                { src: 'widgets/android/drawable/widget_bg.xml', dest: path.join(drawablePath, 'widget_bg.xml') },
                { src: 'widgets/android/drawable/widget_pill_bg.xml', dest: path.join(drawablePath, 'widget_pill_bg.xml') },
            ];

            // Optional face drawable
            const mazoFacePath = path.join(projectRoot, 'widgets/android/drawable/mazo_face.png');
            if (fs.existsSync(mazoFacePath)) {
                filesToCopy.push({ src: 'widgets/android/drawable/mazo_face.png', dest: path.join(drawablePath, 'mazo_face.png') });
            }

            // Remove old widget files from previous builds
            const oldFiles = [
                'GoalsWidgetProvider.kt', 'ScheduleWidgetProvider.kt'
            ];
            for (const f of oldFiles) {
                const p = path.join(srcPath, f);
                if (fs.existsSync(p)) fs.unlinkSync(p);
            }
            const oldLayouts = [
                'mazo_widget_goals.xml', 'mazo_widget_goals_item.xml',
                'mazo_widget_schedule.xml', 'mazo_widget_schedule_item.xml'
            ];
            for (const f of oldLayouts) {
                const p = path.join(layoutPath, f);
                if (fs.existsSync(p)) fs.unlinkSync(p);
            }
            const oldXmls = [
                'mazo_widget_goals_info.xml', 'mazo_widget_schedule_info.xml'
            ];
            for (const f of oldXmls) {
                const p = path.join(xmlPath, f);
                if (fs.existsSync(p)) fs.unlinkSync(p);
            }

            for (const file of filesToCopy) {
                const sourceFilePath = path.join(projectRoot, file.src);
                if (fs.existsSync(sourceFilePath)) {
                    fs.copyFileSync(sourceFilePath, file.dest);
                } else {
                    console.warn(`[MazoWidget] Missing source file: ${sourceFilePath}`);
                }
            }

            return config;
        },
    ]);
}

/** Main plugin */
function withMazoWidget(config) {
    config = withIosAppGroups(config);
    config = withAndroidWidget(config);
    config = withAndroidFiles(config);
    return config;
}

module.exports = withMazoWidget;
