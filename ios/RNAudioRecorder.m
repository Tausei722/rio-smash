#import "RNAudioRecorder.h"
#import <AVFoundation/AVFoundation.h>

@implementation RNAudioRecorder

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(startRecording:(NSString *)path
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [[AVAudioSession sharedInstance] requestRecordPermission:^(BOOL granted) {
    if (!granted) {
      reject(@"PERMISSION_DENIED", @"マイクのアクセスが拒否されています", nil);
      return;
    }

    NSError *error = nil;
    AVAudioSession *session = [AVAudioSession sharedInstance];
    [session setCategory:AVAudioSessionCategoryPlayAndRecord
             withOptions:AVAudioSessionCategoryOptionDefaultToSpeaker
                   error:&error];
    if (error) { reject(@"SESSION_ERROR", error.localizedDescription, error); return; }
    [session setActive:YES error:&error];
    if (error) { reject(@"SESSION_ERROR", error.localizedDescription, error); return; }

    NSURL *url = [NSURL fileURLWithPath:path];
    NSDictionary *settings = @{
      AVFormatIDKey: @(kAudioFormatMPEG4AAC),
      AVSampleRateKey: @44100.0,
      AVNumberOfChannelsKey: @1,
      AVEncoderAudioQualityKey: @(AVAudioQualityHigh)
    };

    NSError *recError = nil;
    self.audioRecorder = [[AVAudioRecorder alloc] initWithURL:url settings:settings error:&recError];
    if (recError) { reject(@"RECORD_INIT_ERROR", recError.localizedDescription, recError); return; }

    [self.audioRecorder record];
    resolve(nil);
  }];
}

RCT_EXPORT_METHOD(stopRecording:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  if (!self.audioRecorder) {
    reject(@"NO_RECORDER", @"録音が開始されていません", nil);
    return;
  }

  NSString *path = self.audioRecorder.url.path;
  [self.audioRecorder stop];
  self.audioRecorder = nil;

  [[AVAudioSession sharedInstance] setActive:NO
                                 withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation
                                       error:nil];
  resolve(path);
}

RCT_EXPORT_METHOD(startPlayback:(NSString *)path
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    NSError *error = nil;
    [[AVAudioSession sharedInstance] setCategory:AVAudioSessionCategoryPlayback error:nil];
    [[AVAudioSession sharedInstance] setActive:YES error:nil];

    NSURL *url = [path hasPrefix:@"file://"] ? [NSURL URLWithString:path] : [NSURL fileURLWithPath:path];

    self.audioPlayer = [[AVAudioPlayer alloc] initWithContentsOfURL:url error:&error];
    if (error) { reject(@"PLAY_ERROR", error.localizedDescription, error); return; }

    [self.audioPlayer play];
    resolve(nil);
  });
}

RCT_EXPORT_METHOD(stopPlayback:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  [self.audioPlayer stop];
  self.audioPlayer = nil;
  resolve(nil);
}

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

@end
