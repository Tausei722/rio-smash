#import <React/RCTBridgeModule.h>
#import <AVFoundation/AVFoundation.h>

@interface RNAudioRecorder : NSObject <RCTBridgeModule>
@property (nonatomic, strong) AVAudioRecorder *audioRecorder;
@property (nonatomic, strong) AVAudioPlayer *audioPlayer;
@end
