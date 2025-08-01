import { formatTimestamp } from '../../../lib/utils';
import { BasePlatformExtractor, Platform, ExtractOptions, ExtractResult, InsufficientCreditsError } from '../../DataExtractor';
import { ProxyUtils } from '../../../lib/ProxyUtils';

export class XhsDetailsExtractor extends BasePlatformExtractor {
  protected platform: Platform = 'xhs';
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

      reportProgress(0, '开始提取笔记详情...');

      // 构建请求负载
      const payload = {
        url: url.trim(),
      };

      const endpoint = this.getApiEndpoint();
      const result = await this.makeRequest(endpoint, payload);

      // 检查响应数据结构
      if (!result.data?.data || !Array.isArray(result.data.data) || result.data.data.length === 0) {
        throw new Error('笔记详情数据结构异常');
      }

      reportProgress(50, '正在格式化数据...');
      const formattedData = await this.formatData(result.data.data);

      reportProgress(100, '笔记详情提取完成');

      return {
        success: true,
        data: formattedData,
        totalCount: 1,
        platform: '小红书',
        extractType: this.extractType,
        message: '小红书笔记详情提取成功',
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
        message: error instanceof Error ? error.message : '小红书笔记详情提取失败',
      };
    }
  }

  protected getApiEndpoint(): string {
    return '/xhs/note/detail';
  }

  protected getTypeDisplayName(): string {
    return '小红书详情';
  }

  protected async formatData(dataList: any[]): Promise<any[]> {
    const formattedItems = [];

    for (const data of dataList) {
      // 获取笔记列表中的第一个笔记
      const noteList = data.note_list;
      if (!noteList || !Array.isArray(noteList) || noteList.length === 0) {
        continue;
      }

      const note = noteList[0];
      const user = note.user || data.user;

      // 基础信息
      const baseData: any = {
        平台: '小红书',
        笔记ID: note.id || '',
        标题: note.title || '',
        描述: note.desc || '',
        发布时间: formatTimestamp(note.time), // 小红书时间戳是秒
        笔记类型: note.type || '',

        // 作者信息
        作者ID: user.id || user.userid || '',
        作者昵称: user.name || user.nickname || '',
        作者头像: await this.getProxyUrl(user.image),
        是否关注: user.followed || false,

        // 统计数据
        点赞数: (note.liked_count || 0).toLocaleString(),
        收藏数: (note.collected_count || 0).toLocaleString(),
        评论数: (note.comments_count || 0).toLocaleString(),
        浏览数: (note.view_count || 0).toLocaleString(),
        是否点赞: note.liked || false,
        是否收藏: note.collected || false,
        是否置顶: note.sticky || false,

        // 分享信息
        分享链接: note.share_info?.link || '',
        分享标题: note.share_info?.title || '',
        分享内容: note.share_info?.content || '',

        // 媒体保存配置
        禁止保存: note.media_save_config?.disable_save || false,
        禁止水印: note.media_save_config?.disable_watermark || false,

        提取时间: Date.now(),
      };

      // 处理图片列表
      if (note.images_list && Array.isArray(note.images_list)) {
        for (let i = 0; i < note.images_list.length; i++) {
          const image = note.images_list[i];
          const imageUrl = await this.getProxyUrl(image.url || image.original);
          baseData[`图片${i + 1}`] = imageUrl;
          baseData[`图片${i + 1}_尺寸`] = `${image.width}x${image.height}`;
        }
      }

      // 处理视频信息（如果有）
      if (note.video && Object.keys(note.video).length > 0) {
        // 小红书视频信息处理（根据实际数据结构调整）
        baseData['视频信息'] = JSON.stringify(note.video);
      }

      formattedItems.push(baseData);
    }

    return formattedItems;
  }

  // 获取代理URL
  private async getProxyUrl(url: string): Promise<string> {
    if (!url || typeof url !== 'string') {
      return '';
    }

    try {
      return await ProxyUtils.smartProxyUrl(url, 'xhs');
    } catch (error) {
      console.error(`生成代理URL失败: ${url}`, error);
      return url; // 失败时返回原始URL
    }
  }
}
