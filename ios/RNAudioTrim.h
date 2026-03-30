#import <React/RCTBridgeModule.h>
#import <AVFoundation/AVFoundation.h>

@interface RNAudioTrim : NSObject <RCTBridgeModule, AVAudioPlayerDelegate>

@property (nonatomic, strong) AVAudioPlayer *previewPlayer;
@property (nonatomic, strong) NSTimer *previewTimer;

@end
