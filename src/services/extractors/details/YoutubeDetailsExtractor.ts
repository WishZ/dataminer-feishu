import { formatDuration, formatTimestamp } from '../../../lib/utils';
import { BasePlatformExtractor, Platform, ExtractOptions, ExtractResult, InsufficientCreditsError } from '../../DataExtractor';
import { ResolutionUtils } from '../../../lib/ResolutionUtils';
import { ProxyUtils } from '../../../lib/ProxyUtils';

export class YoutubeDetailsExtractor extends BasePlatformExtractor {
  protected platform: Platform = 'youtube';
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
          if (result.data) {
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
        platform: 'YouTube',
        extractType: this.extractType,
        message: `YouTube视频详情提取成功，共提取 ${allFormattedData.length} 条数据`,
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
        message: error instanceof Error ? error.message : 'YouTube视频详情提取失败',
      };
    }
  }

  protected getApiEndpoint(): string {
    return '/youtube/video/info';
  }

  protected getTypeDisplayName(): string {
    return 'YouTube详情';
  }

  protected async formatData(videoList: any[]): Promise<any[]> {
    const formattedItems = [];

    for (const video of videoList) {
      // 基础信息
      const baseData: any = {
        平台: 'YouTube',
        视频ID: video.id || '',
        标题: video.title || video.fulltitle || '',
        描述: video.description || '',
        发布时间: this.formatUploadDate(video.upload_date),
        视频时长: formatDuration(video.duration || 0),
        视频封面: video.thumbnail ? await ProxyUtils.smartProxyUrl(video.thumbnail, 'youtube') : '',

        // 频道信息
        频道ID: video.channel_id || '',
        频道名称: video.channel || video.uploader || '',
        频道链接: video.channel_url || video.uploader_url || '',
        频道订阅数: video.channel_follower_count.toLocaleString() || 0,
        上传者: video.uploader || '',
        上传者ID: video.uploader_id || '',

        // 统计数据
        观看数: video.view_count.toLocaleString() || 0,
        点赞数: video.like_count.toLocaleString() || 0,
        评论数: video.comment_count.toLocaleString() || 0,
        平均评分: video.average_rating || null,

        // 视频属性
        年龄限制: video.age_limit || 0,
        是否直播: video.is_live || false,
        曾经直播: video.was_live || false,

        // 链接信息
        网页链接: video.webpage_url || '',
        原始链接: video.original_url || '',

        // 缩略图信息
        缩略图信息: await this.formatThumbnails(video.thumbnails),

        // 字幕信息
        字幕信息: await this.formatSubtitles(video.id, video.subtitles),

        提取时间: Date.now(),
      };

      // 初始化所有支持的分辨率列为空字符串
      ResolutionUtils.supportedResolutions.forEach(resolution => {
        baseData[`视频分辨率_${resolution}`] = '';
      });

      // 处理视频格式信息，提取不同分辨率的视频链接
      if (video.formats && Array.isArray(video.formats)) {
        // 过滤出视频格式（排除音频和故事板）
        const videoFormats = video.formats.filter((format: any) =>
          format.vcodec && format.vcodec !== 'none' &&
          format.format_note !== 'storyboard' &&
          format.width && format.height
        );

        for (const format of videoFormats) {
          if (format.url && format.width && format.height) {
            // 使用ResolutionUtils标准化分辨率
            const rawResolution = `${format.width}x${format.height}`;
            const standardResolution = ResolutionUtils.normalizeResolution(rawResolution);

            if (standardResolution) {
              const columnName = `视频分辨率_${standardResolution}`;

              // 只有在还没有设置该分辨率时才设置，优先使用更好的质量
              if (!baseData[columnName]) {
                const proxyUrl = format.url;
                baseData[columnName] = proxyUrl;
              }
            }
          }
        }
      }

      formattedItems.push(baseData);
    }

    return formattedItems;
  }

  // 格式化上传日期
  private formatUploadDate(uploadDate: string): string {
    if (!uploadDate) return '';

    // YouTube的upload_date格式通常是YYYYMMDD
    if (uploadDate.length === 8) {
      const year = uploadDate.substring(0, 4);
      const month = uploadDate.substring(4, 6);
      const day = uploadDate.substring(6, 8);
      const date = new Date(`${year}-${month}-${day}`);
      return formatTimestamp(Math.floor(date.getTime() / 1000));
    }

    return uploadDate;
  }

  // 格式化缩略图信息
  private async formatThumbnails(thumbnails: any[]): Promise<string> {
    if (!thumbnails || !Array.isArray(thumbnails) || thumbnails.length === 0) {
      return '';
    }

    const thumbnailDetails = [];

    for (const thumbnail of thumbnails.slice(0, 5)) { // 只取前5个缩略图
      const details: string[] = [];

      if (thumbnail.width && thumbnail.height) {
        details.push(`尺寸: ${thumbnail.width}x${thumbnail.height}`);
      }

      if (thumbnail.url) {
        const proxyUrl = await ProxyUtils.smartProxyUrl(thumbnail.url, 'youtube');
        details.push(`链接: ${proxyUrl}`);
      }

      thumbnailDetails.push(details.join(', '));
    }

    return thumbnailDetails.join(' | ');
  }

  // 格式化字幕信息
  private async formatSubtitles(videoId:string, subtitles: any): Promise<string> {
    if (!subtitles || typeof subtitles !== 'object') {
      return '';
    }

    const subtitleDetails = [];

    // 遍历不同语言的字幕
    for (const [language, subtitleList] of Object.entries(subtitles)) {
      if (Array.isArray(subtitleList)) {
        for (const subtitle of subtitleList) {
          const details: string[] = [];

          details.push(`语言: ${language}`);

          if (subtitle.ext) {
            details.push(`格式: ${subtitle.ext.toUpperCase()}`);
          }

          if (subtitle.url) {
            const proxyUrl = await ProxyUtils.buildDownloadProxyUrl(subtitle.url,3600, 'youtube', '', videoId + '_' + language + '.' + subtitle.ext);
            details.push(`链接: ${proxyUrl}`);
          }

          subtitleDetails.push(details.join(', '));
        }
      }
    }

    return subtitleDetails.join(' | ');
  }
}
