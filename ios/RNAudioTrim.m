#import "RNAudioTrim.h"
#import <AVFoundation/AVFoundation.h>

@implementation RNAudioTrim

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(getDuration:(NSString *)inputPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSURL *url = urlFromPath(inputPath);
  AVAsset *asset = [AVAsset assetWithURL:url];
  [asset loadValuesAsynchronouslyForKeys:@[@"duration"] completionHandler:^{
    CMTime time = asset.duration;
    double seconds = CMTimeGetSeconds(time);
    resolve(@(seconds));
  }];
}

static NSURL *urlFromPath(NSString *path) {
  if ([path hasPrefix:@"file://"]) {
    return [NSURL URLWithString:path];
  }
  return [NSURL fileURLWithPath:path];
}

RCT_EXPORT_METHOD(playPreview:(NSString *)inputPath
                  startTime:(double)startTime
                  endTime:(double)endTime
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [self.previewTimer invalidate];
    self.previewTimer = nil;
    [self.previewPlayer stop];
    self.previewPlayer = nil;

    NSURL *url = urlFromPath(inputPath);
    NSError *error = nil;

    AVAudioSession *session = [AVAudioSession sharedInstance];
    [session setCategory:AVAudioSessionCategoryPlayback error:nil];
    [session setActive:YES error:nil];

    self.previewPlayer = [[AVAudioPlayer alloc] initWithContentsOfURL:url error:&error];
    if (error) {
      reject(@"PLAY_ERROR", error.localizedDescription, error);
      return;
    }

    self.previewPlayer.currentTime = startTime;
    [self.previewPlayer play];

    double duration = endTime - startTime;
    self.previewTimer = [NSTimer scheduledTimerWithTimeInterval:duration
                                                         target:self
                                                       selector:@selector(stopPreviewInternal)
                                                       userInfo:nil
                                                        repeats:NO];
    resolve(nil);
  });
}

- (void)stopPreviewInternal {
  [self.previewPlayer stop];
  self.previewPlayer = nil;
  self.previewTimer = nil;
}

RCT_EXPORT_METHOD(stopPreview:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [self.previewTimer invalidate];
    self.previewTimer = nil;
    [self.previewPlayer stop];
    self.previewPlayer = nil;
    resolve(nil);
  });
}

RCT_EXPORT_METHOD(getWaveformData:(NSString *)inputPath
                  numSamples:(NSInteger)numSamples
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSURL *url = urlFromPath(inputPath);
    AVURLAsset *asset = [AVURLAsset URLAssetWithURL:url options:nil];

    [asset loadValuesAsynchronouslyForKeys:@[@"tracks"] completionHandler:^{
      NSError *loadError = nil;
      AVKeyValueStatus status = [asset statusOfValueForKey:@"tracks" error:&loadError];
      if (status != AVKeyValueStatusLoaded) {
        reject(@"LOAD_ERROR", @"Failed to load audio tracks", loadError);
        return;
      }

      AVAssetTrack *track = [[asset tracksWithMediaType:AVMediaTypeAudio] firstObject];
      if (!track) {
        reject(@"NO_AUDIO", @"No audio track found", nil);
        return;
      }

      NSError *error = nil;
      AVAssetReader *reader = [AVAssetReader assetReaderWithAsset:asset error:&error];
      if (error) {
        reject(@"READER_ERROR", error.localizedDescription, error);
        return;
      }

      NSDictionary *settings = @{
        AVFormatIDKey: @(kAudioFormatLinearPCM),
        AVLinearPCMBitDepthKey: @16,
        AVLinearPCMIsFloatKey: @NO,
        AVLinearPCMIsBigEndianKey: @NO,
      };

      AVAssetReaderTrackOutput *output = [AVAssetReaderTrackOutput
        assetReaderTrackOutputWithTrack:track
        outputSettings:settings];
      output.alwaysCopiesSampleData = NO;

      [reader addOutput:output];
      if (![reader startReading]) {
        reject(@"START_ERROR", @"Failed to start reading audio", nil);
        return;
      }

      NSMutableData *allData = [NSMutableData data];
      while (reader.status == AVAssetReaderStatusReading) {
        CMSampleBufferRef buf = [output copyNextSampleBuffer];
        if (!buf) break;
        CMBlockBufferRef block = CMSampleBufferGetDataBuffer(buf);
        size_t len = CMBlockBufferGetDataLength(block);
        NSMutableData *chunk = [NSMutableData dataWithLength:len];
        CMBlockBufferCopyDataBytes(block, 0, len, [chunk mutableBytes]);
        [allData appendData:chunk];
        CFRelease(buf);
      }

      int16_t *raw = (int16_t *)[allData bytes];
      NSInteger total = [allData length] / sizeof(int16_t);

      if (total == 0) {
        reject(@"NO_DATA", @"No audio data read", nil);
        return;
      }

      NSInteger bucketSize = MAX(1, total / numSamples);
      NSMutableArray *result = [NSMutableArray arrayWithCapacity:numSamples];

      for (NSInteger i = 0; i < numSamples; i++) {
        NSInteger start = i * bucketSize;
        NSInteger end = MIN(start + bucketSize, total);
        double sum = 0.0;
        for (NSInteger j = start; j < end; j++) {
          double v = (double)raw[j] / 32768.0;
          sum += v * v;
        }
        double rms = sqrt(sum / MAX(1, end - start));
        [result addObject:@(rms)];
      }

      resolve(result);
    }];
  });
}

RCT_EXPORT_METHOD(trim:(NSString *)inputPath
                  startTime:(double)startTime
                  endTime:(double)endTime
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSURL *inputURL = urlFromPath(inputPath);

  // file:// を含む場合は実際のパスを取り出す
  NSString *filePath = inputURL.path;
  NSString *outputPath = [[filePath stringByDeletingPathExtension]
                          stringByAppendingString:@"_trimmed.m4a"];
  NSURL *outputURL = [NSURL fileURLWithPath:outputPath];

  [[NSFileManager defaultManager] removeItemAtURL:outputURL error:nil];

  AVURLAsset *asset = [AVURLAsset URLAssetWithURL:inputURL options:nil];

  [asset loadValuesAsynchronouslyForKeys:@[@"duration"] completionHandler:^{
    int32_t timescale = asset.duration.timescale > 0 ? asset.duration.timescale : 44100;
    double totalSec = CMTimeGetSeconds(asset.duration);

    double clampedStart = MAX(0.0, startTime);
    double clampedEnd   = MIN(totalSec, endTime);

    CMTime cmStart    = CMTimeMakeWithSeconds(clampedStart, timescale);
    CMTime cmEnd      = CMTimeMakeWithSeconds(clampedEnd, timescale);
    CMTime cmDuration = CMTimeSubtract(cmEnd, cmStart);

    AVAssetExportSession *session = [[AVAssetExportSession alloc]
                                     initWithAsset:asset
                                     presetName:AVAssetExportPresetAppleM4A];
    session.outputURL      = outputURL;
    session.outputFileType = AVFileTypeAppleM4A;
    session.timeRange      = CMTimeRangeMake(cmStart, cmDuration);

    [session exportAsynchronouslyWithCompletionHandler:^{
      if (session.status == AVAssetExportSessionStatusCompleted) {
        resolve(outputPath);
      } else {
        NSString *msg = session.error ? session.error.localizedDescription : @"Unknown error";
        reject(@"TRIM_ERROR", msg, session.error);
      }
    }];
  }];
}

@end
