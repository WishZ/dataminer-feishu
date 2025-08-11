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
      if (!result.data) {
        throw new Error('笔记详情数据结构异常');
      }

      reportProgress(50, '正在格式化数据...');
      const formattedData = await this.formatData([result.data]);

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
    return '/xhs/note/info/v2';
  }

  protected getTypeDisplayName(): string {
    return '小红书详情';
  }

  protected async formatData(dataList: any[]): Promise<any[]> {
    const formattedItems = [];

    for (const note of dataList) {
      // 新接口直接返回笔记数据
      const author = note.author;

      // 基础信息
      const baseData: any = {
        平台: '小红书',
        笔记ID: note.noteId || '',
        标题: note.title || '',
        内容: note.content || '',
        笔记链接: note.noteLink || '',
        发布时间: note.createDate || '',
        笔记类型: note.noteType == 2 ? '视频' : '普通',
        // 作者信息
        作者ID: author?.userId || '',
        作者昵称: author?.nickname || '',
        作者头像: author?.userSImage || '',

        // 统计数据
        点赞数: note.likeNum || '0',
        收藏数: note.favNum || '0',
        评论数: note.cmtNum || '0',

        提取时间: Date.now(),
      };

      // 处理图片列表
      if (note.images && Array.isArray(note.images)) {
        for (let i = 0; i < note.images.length; i++) {
          const image = note.images[i];
          const imageUrl =image.link;
          baseData[`图片${i + 1}`] = imageUrl;
        }
      }

      // 处理视频信息（如果有）
      if (note.video && Object.keys(note.video).length > 0) {
        const video = note.video;

        // 视频链接（通过代理）
        if (video.link) {
          baseData['视频链接'] = video.link;
        }
      }

      formattedItems.push(baseData);
    }

    return formattedItems;
  }

}
