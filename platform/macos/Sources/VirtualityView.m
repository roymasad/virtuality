#import "VirtualityView.h"
#import <ApplicationServices/ApplicationServices.h>
#import <WebKit/WebKit.h>
#import <unistd.h>

static NSString * const VirtualityDefaultsModule = @"com.roymassaad.virtuality.screensaver";
static __weak VirtualityView *VirtualityActiveFullscreenView = nil;
@interface VirtualityView () <WKNavigationDelegate, WKScriptMessageHandler, NSWindowDelegate>

@property (nonatomic, strong) WKWebView *webView;
@property (nonatomic, strong) NSWindow *configureWindow;
@property (nonatomic, strong) WKWebView *settingsWebView;
@property (nonatomic, assign) BOOL webViewReady;
@property (nonatomic, assign) NSUInteger frameCount;
@property (nonatomic, assign) NSUInteger canvasPollCount;
@property (nonatomic, assign) BOOL previewMode;
@property (nonatomic, strong) NSImage *webSnapshot;
@property (nonatomic, assign) BOOL snapshotInFlight;
@property (nonatomic, assign) NSUInteger snapshotFailureCount;
@property (nonatomic, assign) BOOL savedFirstCanvasFrame;
@property (nonatomic, copy) NSString *lastLoadedConfigurationJSON;
@property (nonatomic, assign) BOOL pageLoadInFlight;
@property (nonatomic, assign) BOOL renderingActive;
@property (nonatomic, copy) NSString *fullscreenStopTokenAtStart;
@property (nonatomic, assign) BOOL observedLockedSession;
@property (nonatomic, assign) BOOL retiredFullscreenView;
@property (nonatomic, assign) NSUInteger idleTerminationGeneration;

- (void)stopWebRenderingWithReason:(NSString *)reason;
- (void)stopSettingsWebViewWithReason:(NSString *)reason;
- (void)publishFullscreenStopTokenWithReason:(NSString *)reason;
- (NSString *)currentFullscreenStopToken;
- (NSString *)selectedRenderMode;
- (BOOL)usesNativeFrameBridge;
- (void)stopFullscreenRenderingForExitEvent:(NSString *)reason;
- (void)registerLifecycleNotifications;
- (void)workspaceSessionBecameActive:(NSNotification *)notification;
- (void)workspaceScreensWoke:(NSNotification *)notification;
- (void)screenSaverWillStop:(NSNotification *)notification;
- (BOOL)sessionScreenIsLocked;
- (void)scheduleFullscreenIdleTerminationWithReason:(NSString *)reason;
- (void)cancelFullscreenIdleTerminationWithReason:(NSString *)reason;
- (NSString *)webViewRole:(WKWebView *)webView;

@end

@implementation VirtualityView

- (instancetype)initWithFrame:(NSRect)frame isPreview:(BOOL)isPreview
{
    self = [super initWithFrame:frame isPreview:isPreview];
    if (self) {
        self.previewMode = isPreview;
        [self setAnimationTimeInterval:1.0 / 60.0];
        self.wantsLayer = YES;
        self.layer.backgroundColor = NSColor.blackColor.CGColor;
        NSBundle *bundle = [NSBundle bundleForClass:self.class];
        NSString *version = bundle.infoDictionary[@"CFBundleShortVersionString"] ?: @"?";
        NSString *build = bundle.infoDictionary[@"CFBundleVersion"] ?: @"?";
        [self logMessage:[NSString stringWithFormat:@"init version=%@ build=%@ pid=%d frame=%@ preview=%@", version, build, getpid(), NSStringFromRect(frame), isPreview ? @"YES" : @"NO"]];
        [self registerLifecycleNotifications];
        [self setupWebView];
    }
    return self;
}

- (void)registerLifecycleNotifications
{
    NSNotificationCenter *workspaceCenter = NSWorkspace.sharedWorkspace.notificationCenter;
    [workspaceCenter addObserver:self selector:@selector(workspaceSessionBecameActive:) name:NSWorkspaceSessionDidBecomeActiveNotification object:nil];
    [workspaceCenter addObserver:self selector:@selector(workspaceScreensWoke:) name:NSWorkspaceScreensDidWakeNotification object:nil];
    [NSDistributedNotificationCenter.defaultCenter addObserver:self
        selector:@selector(screenSaverWillStop:)
        name:@"com.apple.screensaver.willstop"
        object:nil
        suspensionBehavior:NSNotificationSuspensionBehaviorDeliverImmediately
    ];
}

- (void)setupWebView
{
    if (self.webView) return;

    WKWebViewConfiguration *configuration = [self webViewConfigurationWithMessageHandler:NO];

    self.webView = [[WKWebView alloc] initWithFrame:self.bounds configuration:configuration];
    self.webView.navigationDelegate = self;
    self.webView.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
    self.webView.wantsLayer = YES;
    self.webView.alphaValue = 1.0;
    self.webView.hidden = YES;
    self.webView.layer.backgroundColor = NSColor.blackColor.CGColor;
    self.webView.underPageBackgroundColor = NSColor.blackColor;

    [self addSubview:self.webView];
    [self loadScreensaverPage];
}

- (void)loadScreensaverPage
{
    if (!self.webView) {
        [self setupWebView];
        return;
    }

    NSBundle *bundle = [NSBundle bundleForClass:self.class];
    NSURL *resourcesURL = bundle.resourceURL;
    NSURL *htmlURL = [resourcesURL URLByAppendingPathComponent:@"web/screensaver.html"];
    NSString *configurationJSON = [self configurationJSONString];

    self.webViewReady = NO;
    self.webSnapshot = nil;
    self.snapshotInFlight = NO;
    self.savedFirstCanvasFrame = NO;
    self.pageLoadInFlight = YES;
    self.lastLoadedConfigurationJSON = configurationJSON;
    self.webView.hidden = YES;
    self.webView.alphaValue = 1.0;
    [self injectConfigurationJSON:configurationJSON intoWebView:self.webView];
    [self logMessage:[NSString stringWithFormat:@"load screensaver %@ config=%@ bounds=%@ webFrame=%@", htmlURL.absoluteString, configurationJSON, NSStringFromRect(self.bounds), NSStringFromRect(self.webView.frame)]];
    [self.webView loadFileURL:htmlURL allowingReadAccessToURL:resourcesURL];
}

- (void)loadScreensaverPageIfConfigurationChangedWithReason:(NSString *)reason
{
    NSString *configurationJSON = [self configurationJSONString];
    BOOL hasLoadedConfiguration = self.lastLoadedConfigurationJSON.length > 0;
    BOOL shouldLoad = !self.pageLoadInFlight && (!hasLoadedConfiguration || ![configurationJSON isEqualToString:self.lastLoadedConfigurationJSON ?: @""]);

    [self logMessage:[NSString stringWithFormat:@"config check %@ shouldLoad=%@ current=%@ last=%@",
        reason,
        shouldLoad ? @"YES" : @"NO",
        configurationJSON,
        self.lastLoadedConfigurationJSON ?: @"none"
    ]];

    if (shouldLoad) {
        [self loadScreensaverPage];
    }
}

- (void)setFrameSize:(NSSize)newSize
{
    [super setFrameSize:newSize];
    [self layoutScreensaverWebViewWithReason:@"setFrameSize" reload:NO];
}

- (void)setFrame:(NSRect)frameRect
{
    [super setFrame:frameRect];
    [self layoutScreensaverWebViewWithReason:@"setFrame" reload:NO];
}

- (void)viewDidMoveToWindow
{
    [super viewDidMoveToWindow];
    if (!self.window) {
        [self stopWebRenderingWithReason:@"viewDidMoveToWindow nil"];
    }
    [self layoutScreensaverWebViewWithReason:@"viewDidMoveToWindow" reload:self.window != nil];
}

- (void)layoutScreensaverWebViewWithReason:(NSString *)reason reload:(BOOL)reload
{
    if (!self.webView) return;

    self.webView.frame = self.bounds;
    if (self.webViewReady) {
        self.webView.hidden = [self usesNativeFrameBridge];
    }
    [self logMessage:[NSString stringWithFormat:@"%@ bounds=%@ webFrame=%@ ready=%@ hidden=%@ preview=%@ nativeFrameBridge=%@ window=%@",
        reason,
        NSStringFromRect(self.bounds),
        NSStringFromRect(self.webView.frame),
        self.webViewReady ? @"YES" : @"NO",
        self.webView.hidden ? @"YES" : @"NO",
        self.previewMode ? @"YES" : @"NO",
        [self usesNativeFrameBridge] ? @"YES" : @"NO",
        self.window ? @"YES" : @"NO"
    ]];

    if (reload) {
        [self loadScreensaverPageIfConfigurationChangedWithReason:reason];
        return;
    }

    [self.webView evaluateJavaScript:@"window.dispatchEvent(new Event('resize'))" completionHandler:nil];
}

- (ScreenSaverDefaults *)moduleDefaults
{
    ScreenSaverDefaults *defaults = [ScreenSaverDefaults defaultsForModuleWithName:VirtualityDefaultsModule];
    [defaults registerDefaults:@{
        @"sceneId": @"omega",
        @"mode": @"modern",
        @"settingsJSON": @"{}"
    }];
    return defaults;
}

- (NSString *)configurationJSONString
{
    ScreenSaverDefaults *defaults = [self moduleDefaults];
    [defaults synchronize];
    NSString *mode = [self selectedRenderMode];
    NSDictionary *configuration = @{
        @"sceneId": [defaults stringForKey:@"sceneId"] ?: @"omega",
        @"mode": mode,
        @"settings": [self storedSettings],
        @"nativeHost": @(!self.previewMode),
        @"nativeFrameBridge": @([self usesNativeFrameBridge])
    };
    NSData *data = [NSJSONSerialization dataWithJSONObject:configuration options:0 error:nil];
    return [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] ?: @"{}";
}

- (NSString *)selectedRenderMode
{
    ScreenSaverDefaults *defaults = [self moduleDefaults];
    [defaults synchronize];
    NSString *mode = [defaults stringForKey:@"mode"];
    return [mode isEqualToString:@"classic"] ? @"classic" : @"modern";
}

- (BOOL)usesNativeFrameBridge
{
    return !self.previewMode;
}

- (NSDictionary *)storedSettings
{
    NSString *settingsJSON = [[self moduleDefaults] stringForKey:@"settingsJSON"] ?: @"{}";
    NSData *data = [settingsJSON dataUsingEncoding:NSUTF8StringEncoding];
    id settings = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : nil;
    return [settings isKindOfClass:NSDictionary.class] ? settings : @{};
}

- (void)saveConfiguration:(NSDictionary *)configuration
{
    NSDictionary *settings = [configuration[@"settings"] isKindOfClass:NSDictionary.class] ? configuration[@"settings"] : @{};
    NSData *settingsData = [NSJSONSerialization dataWithJSONObject:settings options:0 error:nil];
    NSString *settingsJSON = [[NSString alloc] initWithData:settingsData encoding:NSUTF8StringEncoding] ?: @"{}";
    NSString *sceneId = [configuration[@"sceneId"] isKindOfClass:NSString.class] ? configuration[@"sceneId"] : @"omega";
    NSString *mode = [configuration[@"mode"] isKindOfClass:NSString.class] ? configuration[@"mode"] : @"modern";

    ScreenSaverDefaults *defaults = [self moduleDefaults];
    [defaults setObject:sceneId forKey:@"sceneId"];
    [defaults setObject:[mode isEqualToString:@"classic"] ? @"classic" : @"modern" forKey:@"mode"];
    [defaults setObject:settingsJSON forKey:@"settingsJSON"];
    [defaults synchronize];
    [self logMessage:[NSString stringWithFormat:@"save config scene=%@ mode=%@ settings=%@", sceneId, mode, settingsJSON]];
}

- (void)loadSettingsPage
{
    NSBundle *bundle = [NSBundle bundleForClass:self.class];
    NSURL *resourcesURL = bundle.resourceURL;
    NSURL *htmlURL = [resourcesURL URLByAppendingPathComponent:@"web/settings.html"];

    [self injectCurrentConfigurationIntoWebView:self.settingsWebView];
    [self.settingsWebView loadFileURL:htmlURL allowingReadAccessToURL:resourcesURL];
}

- (void)startAnimation
{
    if (!self.previewMode && self.retiredFullscreenView) {
        [self logMessage:@"startAnimation ignored retired fullscreen view"];
        return;
    }
    [super startAnimation];
    [self cancelFullscreenIdleTerminationWithReason:@"startAnimation"];
    if (!self.webView) {
        [self setupWebView];
    }
    if (self.previewMode) {
        [self publishFullscreenStopTokenWithReason:@"system preview resumed"];
        VirtualityView *fullscreenView = VirtualityActiveFullscreenView;
        if (fullscreenView && fullscreenView != self) {
            fullscreenView.retiredFullscreenView = YES;
            [fullscreenView stopWebRenderingWithReason:@"system preview resumed"];
        }
    } else {
        VirtualityView *previousView = VirtualityActiveFullscreenView;
        if (previousView && previousView != self) {
            previousView.retiredFullscreenView = YES;
            [previousView stopWebRenderingWithReason:@"superseded fullscreen view"];
        }
        VirtualityActiveFullscreenView = self;
        self.fullscreenStopTokenAtStart = [self currentFullscreenStopToken];
        self.observedLockedSession = [self sessionScreenIsLocked];
    }
    self.renderingActive = YES;
    self.snapshotInFlight = NO;
    self.frameCount = 0;
    [self layoutScreensaverWebViewWithReason:@"startAnimation" reload:NO];
    [self loadScreensaverPageIfConfigurationChangedWithReason:@"startAnimation"];
}

- (void)stopAnimation
{
    [self logMessage:[NSString stringWithFormat:@"stopAnimation bounds=%@ webFrame=%@ ready=%@ hidden=%@ preview=%@",
        NSStringFromRect(self.bounds),
        NSStringFromRect(self.webView.frame),
        self.webViewReady ? @"YES" : @"NO",
        self.webView.hidden ? @"YES" : @"NO",
        self.previewMode ? @"YES" : @"NO"
    ]];
    [self stopWebRenderingWithReason:@"stopAnimation"];
    [super stopAnimation];
}

- (void)stopFullscreenRenderingForExitEvent:(NSString *)reason
{
    if (self.previewMode) return;
    [self publishFullscreenStopTokenWithReason:reason];
    [self stopWebRenderingWithReason:reason];
}

- (void)workspaceSessionBecameActive:(NSNotification *)notification
{
    [self stopFullscreenRenderingForExitEvent:@"workspace session became active"];
}

- (void)workspaceScreensWoke:(NSNotification *)notification
{
    [self stopFullscreenRenderingForExitEvent:@"workspace screens woke"];
}

- (void)screenSaverWillStop:(NSNotification *)notification
{
    [self stopFullscreenRenderingForExitEvent:@"screensaver will stop notification"];
}

- (void)mouseMoved:(NSEvent *)event
{
    [self stopFullscreenRenderingForExitEvent:@"fullscreen mouse moved"];
    [super mouseMoved:event];
}

- (void)mouseDown:(NSEvent *)event
{
    [self stopFullscreenRenderingForExitEvent:@"fullscreen mouse down"];
    [super mouseDown:event];
}

- (void)rightMouseDown:(NSEvent *)event
{
    [self stopFullscreenRenderingForExitEvent:@"fullscreen right mouse down"];
    [super rightMouseDown:event];
}

- (void)otherMouseDown:(NSEvent *)event
{
    [self stopFullscreenRenderingForExitEvent:@"fullscreen other mouse down"];
    [super otherMouseDown:event];
}

- (void)keyDown:(NSEvent *)event
{
    [self stopFullscreenRenderingForExitEvent:@"fullscreen key down"];
    [super keyDown:event];
}

- (void)scrollWheel:(NSEvent *)event
{
    [self stopFullscreenRenderingForExitEvent:@"fullscreen scroll"];
    [super scrollWheel:event];
}

- (void)stopWebRenderingWithReason:(NSString *)reason
{
    WKWebView *webView = self.webView;
    if (!webView) {
        if (!self.previewMode && ![reason isEqualToString:@"dealloc"]) {
            [self scheduleFullscreenIdleTerminationWithReason:reason];
        }
        return;
    }

    self.renderingActive = NO;
    self.snapshotInFlight = NO;
    self.pageLoadInFlight = NO;
    self.webViewReady = NO;
    self.webSnapshot = nil;
    self.lastLoadedConfigurationJSON = nil;
    self.fullscreenStopTokenAtStart = nil;
    self.observedLockedSession = NO;
    webView.hidden = YES;

    [self logMessage:[NSString stringWithFormat:@"stop web rendering reason=%@ bounds=%@ preview=%@",
        reason,
        NSStringFromRect(self.bounds),
        self.previewMode ? @"YES" : @"NO"
    ]];
    if (!self.previewMode && VirtualityActiveFullscreenView == self) {
        VirtualityActiveFullscreenView = nil;
    }
    [webView evaluateJavaScript:@"try { window.__VIRTUALITY_STOP__?.(); delete window.__VIRTUALITY_RENDER_FRAME__; delete window.__VIRTUALITY_STOP__; } catch (_) {}" completionHandler:nil];
    [webView stopLoading];
    webView.navigationDelegate = nil;
    [webView.configuration.userContentController removeScriptMessageHandlerForName:@"virtualityLog"];
    [webView removeFromSuperview];
    self.webView = nil;

    if (!self.previewMode && ![reason isEqualToString:@"dealloc"]) {
        [self scheduleFullscreenIdleTerminationWithReason:reason];
    }
}

- (void)cancelFullscreenIdleTerminationWithReason:(NSString *)reason
{
    self.idleTerminationGeneration += 1;
    if (!self.previewMode) {
        [self logMessage:[NSString stringWithFormat:@"cancel fullscreen idle termination reason=%@", reason]];
    }
}

- (void)scheduleFullscreenIdleTerminationWithReason:(NSString *)reason
{
    if (self.previewMode) return;

    self.idleTerminationGeneration += 1;
    NSUInteger generation = self.idleTerminationGeneration;
    [self logMessage:[NSString stringWithFormat:@"schedule fullscreen idle termination reason=%@ generation=%lu", reason, (unsigned long)generation]];

    __weak typeof(self) weakSelf = self;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(65.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        VirtualityView *strongSelf = weakSelf;
        if (!strongSelf) return;
        if (strongSelf.previewMode || strongSelf.renderingActive || strongSelf.webView || strongSelf.configureWindow || strongSelf.settingsWebView || strongSelf.idleTerminationGeneration != generation) {
            [strongSelf logMessage:[NSString stringWithFormat:@"skip fullscreen idle termination generation=%lu active=%@ webView=%@ settings=%@",
                (unsigned long)generation,
                strongSelf.renderingActive ? @"YES" : @"NO",
                strongSelf.webView ? @"YES" : @"NO",
                (strongSelf.configureWindow || strongSelf.settingsWebView) ? @"YES" : @"NO"
            ]];
            return;
        }

        [strongSelf logMessage:[NSString stringWithFormat:@"terminate fullscreen idle host generation=%lu", (unsigned long)generation]];
        [NSApp terminate:nil];
    });
}

- (NSString *)fullscreenStopTokenPath
{
    return [NSTemporaryDirectory() stringByAppendingPathComponent:[NSString stringWithFormat:@"VirtualityScreensaver.%u.fullscreen-stop", getuid()]];
}

- (NSString *)currentFullscreenStopToken
{
    NSString *token = [NSString stringWithContentsOfFile:[self fullscreenStopTokenPath] encoding:NSUTF8StringEncoding error:nil];
    return token ?: @"";
}

- (void)publishFullscreenStopTokenWithReason:(NSString *)reason
{
    NSString *token = [NSString stringWithFormat:@"%.6f:%d:%@", NSDate.date.timeIntervalSince1970, getpid(), reason ?: @""];
    [token writeToFile:[self fullscreenStopTokenPath] atomically:YES encoding:NSUTF8StringEncoding error:nil];
    [self logMessage:[NSString stringWithFormat:@"publish fullscreen stop token reason=%@ token=%@", reason, token]];
}

- (void)stopSettingsWebViewWithReason:(NSString *)reason
{
    if (!self.settingsWebView) return;

    [self logMessage:[NSString stringWithFormat:@"stop settings webview reason=%@", reason]];
    [self.settingsWebView evaluateJavaScript:@"try { window.__VIRTUALITY_STOP__?.(); delete window.__VIRTUALITY_STOP__; } catch (_) {}" completionHandler:nil];
    [self.settingsWebView stopLoading];
    self.settingsWebView.navigationDelegate = nil;
    [self.settingsWebView.configuration.userContentController removeScriptMessageHandlerForName:@"virtualityLog"];
    [self.settingsWebView.configuration.userContentController removeScriptMessageHandlerForName:@"virtualitySettings"];
    if (self.configureWindow.contentView == self.settingsWebView) {
        self.configureWindow.contentView = nil;
    }
    self.settingsWebView = nil;
}

- (void)drawRect:(NSRect)rect
{
    [NSColor.blackColor setFill];
    NSRectFill(rect);

    if (self.webViewReady && ![self usesNativeFrameBridge]) return;

    if (!self.previewMode && self.webSnapshot) {
        NSRect sourceRect = NSMakeRect(0, 0, self.webSnapshot.size.width, self.webSnapshot.size.height);
        NSImageInterpolation interpolation = NSGraphicsContext.currentContext.imageInterpolation;
        NSGraphicsContext.currentContext.imageInterpolation = NSImageInterpolationNone;
        [self.webSnapshot drawInRect:self.bounds fromRect:sourceRect operation:NSCompositingOperationSourceOver fraction:1.0 respectFlipped:YES hints:nil];
        NSGraphicsContext.currentContext.imageInterpolation = interpolation;
        return;
    }

    CGFloat width = NSWidth(self.bounds);
    CGFloat height = NSHeight(self.bounds);
    CGFloat t = (CGFloat)self.frameCount / 30.0;
    NSPoint center = NSMakePoint(width * 0.5, height * 0.5);

    for (NSUInteger index = 0; index < 72; index += 1) {
        CGFloat phase = t * 1.6 + (CGFloat)index * 0.19;
        CGFloat radius = MIN(width, height) * (0.16 + 0.0025 * (CGFloat)index);
        NSPoint a = NSMakePoint(center.x + cos(phase) * radius, center.y + sin(phase * 0.7) * radius * 0.62);
        NSPoint b = NSMakePoint(center.x + cos(phase + 1.8) * radius * 0.8, center.y + sin(phase + 1.2) * radius * 0.54);
        NSColor *color = [NSColor colorWithCalibratedHue:fmod((CGFloat)index / 72.0 + t * 0.05, 1.0) saturation:0.9 brightness:1.0 alpha:0.75];
        [color setStroke];

        NSBezierPath *path = [NSBezierPath bezierPath];
        path.lineWidth = 1.5;
        [path moveToPoint:a];
        [path lineToPoint:b];
        [path stroke];
    }

    NSDictionary *attrs = @{
        NSFontAttributeName: [NSFont monospacedSystemFontOfSize:MAX(18.0, MIN(width, height) * 0.06) weight:NSFontWeightBold],
        NSForegroundColorAttributeName: [NSColor colorWithCalibratedRed:0.44 green:1.0 blue:0.55 alpha:0.92]
    };
    NSString *title = @"VIRTUALITY";
    NSSize titleSize = [title sizeWithAttributes:attrs];
    [title drawAtPoint:NSMakePoint(center.x - titleSize.width * 0.5, center.y - titleSize.height * 0.5) withAttributes:attrs];
}

- (void)animateOneFrame
{
    self.frameCount += 1;
    if (!self.renderingActive || !self.window) return;
    if (!self.previewMode && VirtualityActiveFullscreenView != self) return;
    if (!self.previewMode && self.frameCount % 15 == 0) {
        NSString *currentStopToken = [self currentFullscreenStopToken];
        if (self.fullscreenStopTokenAtStart && ![currentStopToken isEqualToString:self.fullscreenStopTokenAtStart]) {
            [self stopWebRenderingWithReason:@"fullscreen stop token changed"];
            return;
        }
        BOOL screenLocked = [self sessionScreenIsLocked];
        if (screenLocked) {
            self.observedLockedSession = YES;
        } else if (self.observedLockedSession) {
            [self stopWebRenderingWithReason:@"session unlocked"];
            return;
        }
    }
    if (!self.previewMode && !self.window.visible) {
        [self stopWebRenderingWithReason:@"fullscreen window hidden"];
        return;
    }
    if (![self usesNativeFrameBridge]) return;
    [self requestWebSnapshotIfNeeded];
    [self setNeedsDisplay:YES];
}

- (void)requestWebSnapshotIfNeeded
{
    if (![self usesNativeFrameBridge] || self.previewMode || !self.renderingActive || !self.window || !self.window.visible || !self.webViewReady || self.snapshotInFlight || NSIsEmptyRect(self.webView.bounds)) return;

    self.snapshotInFlight = YES;
    NSString *script = @"(() => { const canvas = document.querySelector('canvas'); if (!canvas) return { ok: false, reason: 'no canvas' }; try { if (typeof window.__VIRTUALITY_RENDER_FRAME__ === 'function') return window.__VIRTUALITY_RENDER_FRAME__(); return { ok: true, width: canvas.width, height: canvas.height, frame: -1, dataURL: canvas.toDataURL('image/png') }; } catch (error) { return { ok: false, reason: String(error) }; } })()";

    [self.webView evaluateJavaScript:script completionHandler:^(id result, NSError *error) {
        self.snapshotInFlight = NO;
        if (!self.renderingActive || !self.window) return;
        NSDictionary *details = [result isKindOfClass:NSDictionary.class] ? result : @{};
        BOOL ok = [details[@"ok"] respondsToSelector:@selector(boolValue)] ? [details[@"ok"] boolValue] : NO;
        NSString *dataURL = [details[@"dataURL"] isKindOfClass:NSString.class] ? details[@"dataURL"] : nil;
        NSRange comma = dataURL ? [dataURL rangeOfString:@","] : NSMakeRange(NSNotFound, 0);

        if (ok && comma.location != NSNotFound) {
            NSString *base64 = [dataURL substringFromIndex:comma.location + 1];
            NSData *data = [[NSData alloc] initWithBase64EncodedString:base64 options:NSDataBase64DecodingIgnoreUnknownCharacters];
            NSImage *image = data ? [[NSImage alloc] initWithData:data] : nil;

            if (image) {
                self.webSnapshot = image;
                self.snapshotFailureCount = 0;
                if (!self.savedFirstCanvasFrame) {
                    self.savedFirstCanvasFrame = YES;
                    [data writeToFile:@"/tmp/VirtualityScreensaver-frame.png" atomically:YES];
                }
                if (self.frameCount % 60 == 0) {
                    [self logMessage:[NSString stringWithFormat:@"canvas image size=%@ canvas=%@x%@ css=%@x%@ pixelRatio=%@ frame=%@ sample=%@/%@ bytes=%lu bounds=%@",
                        NSStringFromSize(image.size),
                        details[@"width"] ?: @"?",
                        details[@"height"] ?: @"?",
                        details[@"cssWidth"] ?: @"?",
                        details[@"cssHeight"] ?: @"?",
                        details[@"pixelRatio"] ?: @"?",
                        details[@"frame"] ?: @"?",
                        details[@"sampleNonBlack"] ?: @"?",
                        details[@"sampleTotal"] ?: @"?",
                        (unsigned long)data.length,
                        NSStringFromRect(self.bounds)
                    ]];
                }
                [self setNeedsDisplay:YES];
                return;
            }
        }

        self.snapshotFailureCount += 1;
        if (self.snapshotFailureCount <= 3 || self.snapshotFailureCount % 60 == 0) {
            [self logMessage:[NSString stringWithFormat:@"canvas image failed count=%lu ok=%@ reason=%@ error=%@",
                (unsigned long)self.snapshotFailureCount,
                ok ? @"YES" : @"NO",
                details[@"reason"] ?: @"none",
                error.localizedDescription ?: @"none"
            ]];
        }
    }];
}

- (void)requestWebViewSnapshotIfNeeded
{
    if (self.previewMode || !self.renderingActive || !self.window || !self.webViewReady || self.snapshotInFlight || NSIsEmptyRect(self.webView.bounds)) return;

    self.snapshotInFlight = YES;
    WKSnapshotConfiguration *configuration = [[WKSnapshotConfiguration alloc] init];
    configuration.rect = self.webView.bounds;
    configuration.afterScreenUpdates = NO;

    [self.webView takeSnapshotWithConfiguration:configuration completionHandler:^(NSImage *snapshot, NSError *error) {
        self.snapshotInFlight = NO;
        if (!self.renderingActive || !self.window) return;
        if (snapshot) {
            self.webSnapshot = snapshot;
            self.snapshotFailureCount = 0;
            if (self.frameCount % 60 == 0) {
                [self logMessage:[NSString stringWithFormat:@"snapshot size=%@ bounds=%@", NSStringFromSize(snapshot.size), NSStringFromRect(self.bounds)]];
            }
            [self setNeedsDisplay:YES];
            return;
        }

        self.snapshotFailureCount += 1;
        if (self.snapshotFailureCount <= 3 || self.snapshotFailureCount % 60 == 0) {
            [self logMessage:[NSString stringWithFormat:@"snapshot failed count=%lu error=%@", (unsigned long)self.snapshotFailureCount, error.localizedDescription ?: @"none"]];
        }
    }];
}

- (BOOL)hasConfigureSheet
{
    [self logMessage:[NSString stringWithFormat:@"hasConfigureSheet -> YES pid=%d preview=%@ window=%@ configureWindow=%@ settingsWebView=%@ mainThread=%@",
        getpid(),
        self.previewMode ? @"YES" : @"NO",
        self.window ? @"YES" : @"NO",
        self.configureWindow ? @"YES" : @"NO",
        self.settingsWebView ? @"YES" : @"NO",
        NSThread.isMainThread ? @"YES" : @"NO"
    ]];
    return YES;
}

- (BOOL)sessionScreenIsLocked
{
    NSDictionary *session = CFBridgingRelease(CGSessionCopyCurrentDictionary());
    id value = session[@"CGSSessionScreenIsLocked"];
    return [value respondsToSelector:@selector(boolValue)] && [value boolValue];
}

- (NSWindow *)configureSheet
{
    [self logMessage:[NSString stringWithFormat:@"configureSheet start pid=%d preview=%@ existingWindow=%@ existingSettingsWebView=%@ mainThread=%@",
        getpid(),
        self.previewMode ? @"YES" : @"NO",
        self.configureWindow ? @"YES" : @"NO",
        self.settingsWebView ? @"YES" : @"NO",
        NSThread.isMainThread ? @"YES" : @"NO"
    ]];
    [self stopSettingsWebViewWithReason:@"configureSheet reload"];
    WKWebViewConfiguration *configuration = [self webViewConfigurationWithMessageHandler:YES];

    self.settingsWebView = [[WKWebView alloc] initWithFrame:NSMakeRect(0, 0, 860, 540) configuration:configuration];
    self.settingsWebView.navigationDelegate = self;
    self.settingsWebView.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
    self.settingsWebView.wantsLayer = YES;
    self.settingsWebView.layer.backgroundColor = NSColor.blackColor.CGColor;
    self.settingsWebView.underPageBackgroundColor = NSColor.blackColor;

    self.configureWindow = [[NSWindow alloc]
        initWithContentRect:NSMakeRect(0, 0, 860, 540)
        styleMask:NSWindowStyleMaskTitled
        backing:NSBackingStoreBuffered
        defer:NO
    ];
    self.configureWindow.title = @"Virtuality Screen Saver";
    self.configureWindow.delegate = self;
    self.configureWindow.contentView = self.settingsWebView;
    self.configureWindow.minSize = NSMakeSize(720, 480);

    [self loadSettingsPage];
    [self logMessage:[NSString stringWithFormat:@"configureSheet return window=%@ settingsWebView=%@ frame=%@ contentView=%@",
        self.configureWindow ? @"YES" : @"NO",
        self.settingsWebView ? @"YES" : @"NO",
        NSStringFromRect(self.configureWindow.frame),
        self.configureWindow.contentView ? @"YES" : @"NO"
    ]];
    return self.configureWindow;
}

- (void)webView:(WKWebView *)webView didFinishNavigation:(WKNavigation *)navigation
{
    [self logMessage:[NSString stringWithFormat:@"webView didFinishNavigation role=%@ url=%@", [self webViewRole:webView], webView.URL.absoluteString ?: @"none"]];
    if (webView == self.webView) {
        self.pageLoadInFlight = NO;
    }
    self.canvasPollCount = 0;
    [self checkCanvasInWebView:webView];
}

- (void)checkCanvasInWebView:(WKWebView *)webView
{
    NSString *script = @"(() => { const canvas = document.querySelector('canvas'); if (!canvas) return { canvas: false }; const rect = canvas.getBoundingClientRect(); let sampleNonBlack = -1; let sampleTotal = 0; let sampleError = ''; try { const ctx = canvas.getContext('2d'); const data = ctx ? ctx.getImageData(0, 0, canvas.width, canvas.height).data : null; if (data) { const pixelCount = canvas.width * canvas.height; const stride = Math.max(4, Math.floor(pixelCount / 1200) * 4); sampleNonBlack = 0; for (let index = 0; index < data.length; index += stride) { sampleTotal += 1; if (data[index] || data[index + 1] || data[index + 2]) sampleNonBlack += 1; } } } catch (error) { sampleError = String(error); } const status = window.__VIRTUALITY_STATUS__ || {}; return { canvas: true, width: canvas.width, height: canvas.height, rectWidth: Math.round(rect.width), rectHeight: Math.round(rect.height), innerWidth: window.innerWidth, innerHeight: window.innerHeight, sampleNonBlack, sampleTotal, sampleError, renderFrame: status.frame ?? -1, renderError: status.error || '' }; })()";
    [webView evaluateJavaScript:script completionHandler:^(id result, NSError *error) {
        NSDictionary *details = [result isKindOfClass:NSDictionary.class] ? result : @{};
        BOOL hasCanvas = [details[@"canvas"] respondsToSelector:@selector(boolValue)] ? [details[@"canvas"] boolValue] : NO;
        NSInteger canvasWidth = [details[@"width"] respondsToSelector:@selector(integerValue)] ? [details[@"width"] integerValue] : 0;
        NSInteger canvasHeight = [details[@"height"] respondsToSelector:@selector(integerValue)] ? [details[@"height"] integerValue] : 0;
        NSInteger rectWidth = [details[@"rectWidth"] respondsToSelector:@selector(integerValue)] ? [details[@"rectWidth"] integerValue] : 0;
        NSInteger rectHeight = [details[@"rectHeight"] respondsToSelector:@selector(integerValue)] ? [details[@"rectHeight"] integerValue] : 0;
        BOOL hasDrawableCanvas = hasCanvas && canvasWidth > 0 && canvasHeight > 0 && rectWidth > 0 && rectHeight > 0;

        [self logMessage:[NSString stringWithFormat:@"webView canvas=%@ size=%ldx%ld rect=%ldx%ld viewport=%@x%@ nativeFrameBridge=%@ sample=%@/%@ frame=%@ renderError=%@ sampleError=%@ error=%@",
            hasCanvas ? @"YES" : @"NO",
            (long)canvasWidth,
            (long)canvasHeight,
            (long)rectWidth,
            (long)rectHeight,
            details[@"innerWidth"] ?: @"?",
            details[@"innerHeight"] ?: @"?",
            [self usesNativeFrameBridge] ? @"YES" : @"NO",
            details[@"sampleNonBlack"] ?: @"?",
            details[@"sampleTotal"] ?: @"?",
            details[@"renderFrame"] ?: @"?",
            details[@"renderError"] ?: @"",
            details[@"sampleError"] ?: @"",
            error.localizedDescription ?: @"none"
        ]];
        if (hasDrawableCanvas && webView == self.webView) {
            self.webViewReady = YES;
            self.webView.hidden = [self usesNativeFrameBridge];
            self.webView.alphaValue = 1.0;
            [self.webView evaluateJavaScript:@"window.dispatchEvent(new Event('resize'))" completionHandler:nil];
            [self setNeedsDisplay:YES];
            return;
        }

        if (!hasDrawableCanvas && webView == self.webView && self.canvasPollCount < 20) {
            self.canvasPollCount += 1;
            dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.15 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
                [self checkCanvasInWebView:webView];
            });
        }
    }];
}

- (void)webView:(WKWebView *)webView didFailNavigation:(WKNavigation *)navigation withError:(NSError *)error
{
    if (webView == self.webView) {
        self.pageLoadInFlight = NO;
    }
    [self logMessage:[NSString stringWithFormat:@"webView didFailNavigation role=%@ %@", [self webViewRole:webView], error.localizedDescription]];
}

- (void)webView:(WKWebView *)webView didFailProvisionalNavigation:(WKNavigation *)navigation withError:(NSError *)error
{
    if (webView == self.webView) {
        self.pageLoadInFlight = NO;
    }
    [self logMessage:[NSString stringWithFormat:@"webView didFailProvisionalNavigation role=%@ %@", [self webViewRole:webView], error.localizedDescription]];
}

- (void)webView:(WKWebView *)webView decidePolicyForNavigationAction:(WKNavigationAction *)navigationAction decisionHandler:(void (^)(WKNavigationActionPolicy))decisionHandler
{
    NSURL *URL = navigationAction.request.URL;
    [self logMessage:[NSString stringWithFormat:@"webView decidePolicy role=%@ url=%@ navigationType=%ld targetFrame=%@",
        [self webViewRole:webView],
        URL.absoluteString ?: @"none",
        (long)navigationAction.navigationType,
        navigationAction.targetFrame ? @"YES" : @"NO"
    ]];

    if (webView == self.settingsWebView && URL && ([URL.scheme isEqualToString:@"http"] || [URL.scheme isEqualToString:@"https"])) {
        [self logMessage:[NSString stringWithFormat:@"open external settings url %@", URL.absoluteString]];
        [NSWorkspace.sharedWorkspace openURL:URL];
        decisionHandler(WKNavigationActionPolicyCancel);
        return;
    }

    decisionHandler(WKNavigationActionPolicyAllow);
}

- (WKWebViewConfiguration *)webViewConfigurationWithMessageHandler:(BOOL)includeMessageHandler
{
    WKUserContentController *userContentController = [[WKUserContentController alloc] init];
    [userContentController addScriptMessageHandler:self name:@"virtualityLog"];
    if (includeMessageHandler) {
        [userContentController addScriptMessageHandler:self name:@"virtualitySettings"];
    }

    WKWebViewConfiguration *configuration = [[WKWebViewConfiguration alloc] init];
    configuration.userContentController = userContentController;
    configuration.suppressesIncrementalRendering = NO;
    [configuration.preferences setValue:@YES forKey:@"allowFileAccessFromFileURLs"];
    [configuration setValue:@YES forKey:@"allowUniversalAccessFromFileURLs"];
    return configuration;
}

- (void)injectCurrentConfigurationIntoWebView:(WKWebView *)webView
{
    [self injectConfigurationJSON:[self configurationJSONString] intoWebView:webView];
}

- (void)injectConfigurationJSON:(NSString *)configurationJSON intoWebView:(WKWebView *)webView
{
    WKUserContentController *controller = webView.configuration.userContentController;
    [controller removeAllUserScripts];
    NSString *source = [NSString stringWithFormat:@"window.__VIRTUALITY_CONFIG__ = %@;"
        "(() => {"
        "  const post = (payload) => {"
        "    try { window.webkit?.messageHandlers?.virtualityLog?.postMessage(payload); } catch (_) {}"
        "  };"
        "  window.addEventListener('error', (event) => post({ type: 'error', message: String(event.message || ''), source: String(event.filename || ''), line: event.lineno || 0, column: event.colno || 0 }));"
        "  window.addEventListener('unhandledrejection', (event) => post({ type: 'rejection', message: String(event.reason?.message || event.reason || '') }));"
        "})();", configurationJSON];
    WKUserScript *script = [[WKUserScript alloc]
        initWithSource:source
        injectionTime:WKUserScriptInjectionTimeAtDocumentStart
        forMainFrameOnly:YES
    ];
    [controller addUserScript:script];
}

- (void)userContentController:(WKUserContentController *)userContentController didReceiveScriptMessage:(WKScriptMessage *)message
{
    if (![message.body isKindOfClass:NSDictionary.class]) return;

    NSDictionary *body = message.body;
    NSString *type = [body[@"type"] isKindOfClass:NSString.class] ? body[@"type"] : @"";

    if ([message.name isEqualToString:@"virtualityLog"]) {
        [self logMessage:[NSString stringWithFormat:@"web script %@ message=%@ source=%@ line=%@ column=%@",
            type.length ? type : @"log",
            body[@"message"] ?: @"",
            body[@"source"] ?: @"",
            body[@"line"] ?: @"",
            body[@"column"] ?: @""
        ]];
        return;
    }

    if (![message.name isEqualToString:@"virtualitySettings"]) return;

    [self logMessage:[NSString stringWithFormat:@"settings message type=%@ body=%@", type, body]];

    if ([type isEqualToString:@"save"] && [body[@"config"] isKindOfClass:NSDictionary.class]) {
        [self saveConfiguration:body[@"config"]];
    }

    if ([type isEqualToString:@"ready"]) {
        [self logMessage:[NSString stringWithFormat:@"settings ready configureWindow=%@ settingsWebView=%@ url=%@",
            self.configureWindow ? @"YES" : @"NO",
            self.settingsWebView ? @"YES" : @"NO",
            self.settingsWebView.URL.absoluteString ?: @"none"
        ]];
    }

    if ([type isEqualToString:@"openUrl"] && [body[@"url"] isKindOfClass:NSString.class]) {
        NSURL *url = [NSURL URLWithString:body[@"url"]];
        [self logMessage:[NSString stringWithFormat:@"settings openUrl %@", url.absoluteString ?: @"invalid"]];
        if (url && ([url.scheme isEqualToString:@"http"] || [url.scheme isEqualToString:@"https"])) {
            [NSWorkspace.sharedWorkspace openURL:url];
        }
    }

    if ([type isEqualToString:@"close"]) {
        [NSApp endSheet:self.configureWindow];
        [self.configureWindow orderOut:nil];
        [self stopSettingsWebViewWithReason:@"settings close"];
        self.configureWindow.delegate = nil;
        self.configureWindow = nil;
    }
}

- (NSString *)webViewRole:(WKWebView *)webView
{
    if (webView == self.webView) return @"screensaver";
    if (webView == self.settingsWebView) return @"settings";
    return @"unknown";
}

- (void)windowWillClose:(NSNotification *)notification
{
    if (notification.object == self.configureWindow) {
        [self stopSettingsWebViewWithReason:@"settings window close"];
        self.configureWindow.delegate = nil;
        self.configureWindow = nil;
    }
}

- (void)dealloc
{
    [self stopWebRenderingWithReason:@"dealloc"];
    [self stopSettingsWebViewWithReason:@"dealloc"];
    [NSWorkspace.sharedWorkspace.notificationCenter removeObserver:self];
    [NSDistributedNotificationCenter.defaultCenter removeObserver:self];
}

- (void)logMessage:(NSString *)message
{
    NSString *line = [NSString stringWithFormat:@"%@ %@\n", [NSDate date], message];
    NSString *logsDirectory = [NSHomeDirectory() stringByAppendingPathComponent:@"Library/Logs"];
    [[NSFileManager defaultManager] createDirectoryAtPath:logsDirectory withIntermediateDirectories:YES attributes:nil error:nil];
    NSArray<NSString *> *paths = @[
        [logsDirectory stringByAppendingPathComponent:@"VirtualityScreensaver.log"],
        @"/tmp/VirtualityScreensaver.log"
    ];

    for (NSString *path in paths) {
        [self appendLogLine:line toPath:path];
    }
}

- (void)appendLogLine:(NSString *)line toPath:(NSString *)path
{
    NSData *data = [line dataUsingEncoding:NSUTF8StringEncoding];
    NSFileHandle *handle = [NSFileHandle fileHandleForWritingAtPath:path];
    if (!handle) {
        [data writeToFile:path atomically:YES];
        return;
    }
    [handle seekToEndOfFile];
    [handle writeData:data];
    [handle closeFile];
}

@end
