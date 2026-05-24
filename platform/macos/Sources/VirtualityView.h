#import <ScreenSaver/ScreenSaver.h>

@interface VirtualityView : ScreenSaverView

@property (readonly) BOOL hasConfigureSheet;
@property (readonly, strong) NSWindow *configureSheet;

@end
