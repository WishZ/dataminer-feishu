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
          reportProgress(progress, `正在提取第 ${i + 1}/${urls.length} 个笔记`);

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

      reportProgress(100, `笔记详情提取完成，成功提取 ${allFormattedData.length} 条数据`);

      return {
        success: true,
        data: allFormattedData,
        totalCount: allFormattedData.length,
        platform: '小红书',
        extractType: this.extractType,
        message: `小红书笔记详情提取成功，共提取 ${allFormattedData.length} 条数据`,
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
