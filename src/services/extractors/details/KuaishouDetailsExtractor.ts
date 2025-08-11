import { formatDuration, formatTimestamp } from '../../../lib/utils';
import { BasePlatformExtractor, Platform, ExtractOptions, ExtractResult, InsufficientCreditsError } from '../../DataExtractor';
import { ResolutionUtils } from '../../../lib/ResolutionUtils';
import { ProxyUtils } from '../../../lib/ProxyUtils';

export class KuaishouDetailsExtractor extends BasePlatformExtractor {
  protected platform: Platform = 'kuaishou';
  protected extractType = 'details';

  constructor(options: ExtractOptions) {
    super(options);
  }

  async extract(url: string): Promise<ExtractResult> {
    try {
      // 进度回调辅助函数
      const reportProgress = (progress: number, message: string) => {
        if (this.options.onProgress && typeof this.options.onProgress === 'function') {
          this.options.onProgress(progress, message);
        }
      };

      reportProgress(0, '开始提取视频详情...');

      // 解析多行URL
      const urls = url.split('\n')
        .map(u => u.trim())
        .filter(u => u.length > 0);

      if (urls.length === 0) {
        throw new Error('未找到有效的URL');
      }

      reportProgress(5, `发现 ${urls.length} 个URL，开始批量提取...`);

      const allFormattedData = [];
      const endpoint = this.getApiEndpoint();

      // 循环处理每个URL
      for (let i = 0; i < urls.length; i++) {
        const currentUrl = urls[i];
        const progress = 10 + (i / urls.length) * 80; // 10-90%的进度用于URL处理

        try {
          reportProgress(progress, `正在提取第 ${i + 1}/${urls.length} 个视频`);

          // 构建请求负载
          const payload = {
            url: currentUrl,
          };

          const result = await this.makeRequest(endpoint, payload);

          // 检查响应数据结构
          if (result.data?.photo) {
            const formattedData = await this.formatData([result.data]);
            allFormattedData.push(...formattedData);
          } else {
            console.warn(`URL ${currentUrl} 返回数据结构异常，跳过`);
          }

          // 添加小延迟避免请求过快
          if (i < urls.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }

        } catch (error) {
          console.error(`提取URL ${currentUrl} 失败:`, error);
          // 继续处理下一个URL，不中断整个流程
          continue;
        }
      }

      reportProgress(95, '正在整理数据...');

      if (allFormattedData.length === 0) {
        throw new Error('所有URL都提取失败，请检查URL格式或网络连接');
      }

      reportProgress(100, `视频详情提取完成，成功提取 ${allFormattedData.length} 条数据`);

      return {
        success: true,
        data: allFormattedData,
        totalCount: allFormattedData.length,
        platform: '快手',
        extractType: this.extractType,
        message: `快手视频详情提取成功，共提取 ${allFormattedData.length} 条数据`,
      };
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        return {
          success: false,
          data: [],
          message: error.message,
        };
      }

      return {
        success: false,
        data: [],
        message: error instanceof Error ? error.message : '快手视频详情提取失败',
      };
    }
  }

  protected getApiEndpoint(): string {
    return '/kuaishou/video/detail';
  }

  protected getTypeDisplayName(): string {
    return '快手详情';
  }

  protected async formatData(dataList: any[]): Promise<any[]> {
    const formattedItems = [];

    for (const data of dataList) {
      const photo = data.photo;

      // 基础信息
      const baseData: any = {
        平台: '快手',
        视频ID: photo.photoId || '',
        标题: photo.caption || '',
        发布时间: formatTimestamp(photo.timestamp / 1000), // 快手时间戳是毫秒
        视频时长: formatDuration(Math.floor(photo.duration / 1000)), // 快手时长是毫秒
        视频封面: await this.getFirstUrl(photo.coverUrls),

        // 作者信息
        作者ID: photo.userId || '',
        作者昵称: photo.userName || '',
        作者头像: await this.getFirstUrl(photo.headUrls),
        作者性别: photo.userSex || '',
        作者认证: photo.verified || false,

        // 统计数据
        点赞数: photo.likeCount.toLocaleString() || 0,
        评论数: photo.commentCount.toLocaleString() || 0,
        分享数: photo.shareCount.toLocaleString() || 0,
        观看数: photo.viewCount.toLocaleString() || 0,
        转发数: photo.forwardCount.toLocaleString() || 0,
        // 音乐信息
        音乐名称: photo.soundTrack?.name || '',
        音乐作者: photo.soundTrack?.artist || '',
        音乐ID: photo.soundTrack?.id || '',
        音乐链接: await this.getFirstUrl(photo.soundTrack?.audioUrls),
        音乐封面: await this.getFirstUrl(photo.soundTrack?.imageUrls),

        提取时间: Date.now(),
      };

      // 初始化所有支持的分辨率列为空字符串
      ResolutionUtils.supportedResolutions.forEach(resolution => {
        baseData[`视频分辨率_${resolution}`] = '';
      });

      // 处理视频流信息，提取不同分辨率的视频链接
      if (photo.manifest?.adaptationSet && Array.isArray(photo.manifest.adaptationSet)) {
        for (const adaptationSet of photo.manifest.adaptationSet) {
          if (adaptationSet.representation && Array.isArray(adaptationSet.representation)) {
            for (const representation of adaptationSet.representation) {
              if (representation.url && representation.width && representation.height) {
                // 使用ResolutionUtils标准化分辨率
                const rawResolution = `${representation.width}x${representation.height}`;
                const standardResolution = ResolutionUtils.normalizeResolution(rawResolution);

                if (standardResolution) {
                  const columnName = `视频分辨率_${standardResolution}`;

                  // 只有在还没有设置该分辨率时才设置，优先使用更好的质量
                  if (!baseData[columnName]) {
                    const proxyUrl = await ProxyUtils.smartProxyUrl(representation.url, 'kuaishou');
                    baseData[columnName] = proxyUrl;
                  }
                }
              }
            }
          }
        }
      }

      formattedItems.push(baseData);
    }

    return formattedItems;
  }

  // 获取URL数组中的第一个URL并应用代理
  private async getFirstUrl(urlArray: any[]): Promise<string> {
    if (!urlArray || !Array.isArray(urlArray) || urlArray.length === 0) {
      return '';
    }

    const firstItem = urlArray[0];
    if (firstItem && firstItem.url) {
      return await ProxyUtils.smartProxyUrl(firstItem.url, 'kuaishou');
    }

    return '';
  }
}
