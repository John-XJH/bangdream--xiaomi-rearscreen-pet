# 第三方来源与许可范围

| 来源 | 本包处理 |
| --- | --- |
| HELPMEEADICE/BANDORI-PET-REV | 功能与资源结构参考；上游GPLv3；保留来源。模型素材不属于其GPL代码许可。https://github.com/HELPMEEADICE/BANDORI-PET-REV |
| PixiJS6.5.10、pixi-live2d-display | MIT许可文本在licenses；运行库未包含，按对应版本条款自行准备。 |
| Live2D旧/新Core | 专有许可，二进制未包含。https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html |
| MediaPipe Tasks Vision1.1.0 | Apache2.0；源码只引用API，依赖与手部模型由使用者通过官方渠道自行取得；模型有其适用条款，源码GPL不覆盖模型。 |
| 游戏模型/音频/背景/Logo/印章/对白 | 未确认可公开再分发授权，全部从源码与公开安装工具中排除；本地完整验收包也不表示获得公开分发授权。 |

上游明确声明模型资源不在GPL许可范围： https://github.com/HELPMEEADICE/BANDORI-PET-REV/blob/main/DISCLAIMER.md

依赖获取脚本的Maven源为 dl.google.com/dl/android/maven2 和 repo.maven.apache.org/maven2。以下是本机编译所用依赖的POM许可声明清单；正式分发编译产物时还需保留所分发版本的版权及NOTICE。

- com.google.mediapipe:tasks-vision:1.1.0 — The Apache Software License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0.txt
- androidx.annotation:annotation:1.1.0 — The Apache Software License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0.txt
- com.google.guava:guava:27.0.1-android — POM无本级许可声明时需检查父POM或JAR内许可
- com.google.guava:failureaccess:1.0.1 — POM无本级许可声明时需检查父POM或JAR内许可
- com.google.guava:listenablefuture:9999.0-empty-to-avoid-conflict-with-guava — POM无本级许可声明时需检查父POM或JAR内许可
- com.google.code.findbugs:jsr305:3.0.2 — The Apache Software License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0.txt
- org.checkerframework:checker-compat-qual:2.5.2 — GNU General Public License, version 2 (GPL2), with the classpath exception http://www.gnu.org/software/classpath/license.html; The MIT License http://opensource.org/licenses/MIT
- com.google.errorprone:error_prone_annotations:2.2.0 — Apache 2.0 http://www.apache.org/licenses/LICENSE-2.0.txt
- com.google.j2objc:j2objc-annotations:1.1 — The Apache Software License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0.txt
- org.codehaus.mojo:animal-sniffer-annotations:1.17 — POM无本级许可声明时需检查父POM或JAR内许可
- com.google.mediapipe:tasks-core:1.1.0 — The Apache Software License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0.txt
- com.google.flogger:flogger:0.6 — Apache 2.0 https://www.apache.org/licenses/LICENSE-2.0.txt
- com.google.flogger:flogger-system-backend:0.6 — Apache 2.0 https://www.apache.org/licenses/LICENSE-2.0.txt
- com.google.protobuf:protobuf-javalite:4.26.1 — POM无本级许可声明时需检查父POM或JAR内许可
- com.google.android.datatransport:transport-api:3.0.0 — The Apache Software License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0.txt
- com.google.android.datatransport:transport-backend-cct:3.1.0 — The Apache Software License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0.txt
- com.google.android.datatransport:transport-runtime:3.1.0 — The Apache Software License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0.txt
- com.google.firebase:firebase-encoders:17.0.0 — The Apache Software License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0.txt
- com.google.firebase:firebase-encoders-proto:16.0.0 — The Apache Software License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0.txt
- javax.inject:javax.inject:1 — POM无本级许可声明时需检查父POM或JAR内许可
- com.google.firebase:firebase-encoders-json:18.0.0 — The Apache Software License, Version 2.0 http://www.apache.org/licenses/LICENSE-2.0.txt
