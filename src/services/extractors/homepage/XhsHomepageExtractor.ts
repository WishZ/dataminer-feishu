import { formatDuration, formatTimestamp } from '../../../lib/utils';
import { BasePlatformExtractor, Platform, ExtractOptions, ExtractResult, InsufficientCreditsError } from '../../DataExtractor';
import { ResolutionUtils } from '../../../lib/ResolutionUtils';
import { ProxyUtils } from '../../../lib/ProxyUtils';

export class XhsHomepageExtractor extends BasePlatformExtractor {
  protected platform: Platform = 'xhs';
  protected extractType = 'homepage';

  constructor(options: ExtractOptions) {
    super(options);
  }

  // 重写 extract 方法以支持自动分页
  async extract(url: string): Promise<ExtractResult> {
    try {
      // 进度回调辅助函数
      const reportProgress = (progress: number, message: string) => {
        if (this.options.onProgress && typeof this.options.onProgress === 'function') {
          this.options.onProgress(progress, message);
        }
      };

      reportProgress(0, '开始提取数据...');

      let allData: any[] = [];
      let currentPage = 1;
      let hasNextPage = true;
      let lastCursor: string | undefined = undefined;
      const maxPages = this.options.range === 'all' ? 100 : (this.options.range as number);

      // 从URL中提取userId
      const userId = this.extractUserIdFromUrl(url);
      if (!userId) {
        throw new Error('无法从URL中提取用户ID');
      }

      while (hasNextPage && currentPage <= maxPages) {
        const pageProgress = ((currentPage - 1) / maxPages) * 90;
        reportProgress(pageProgress, `正在提取第 ${currentPage} 页数据...`);
        console.log(`正在提取第 ${currentPage} 页数据...`);

        // 构建当前页的请求负载
        const payload: any = {
          userId,
        };

        // 如果有 lastCursor，添加到请求中用于翻页
        if (lastCursor !== undefined && currentPage > 1) {
          payload.lastCursor = lastCursor;
          console.log(`使用 lastCursor 进行翻页: ${lastCursor}`);
        }

        try {
          const endpoint = this.getApiEndpoint();
          const result = await this.makeRequest(endpoint, payload);

          // 检查响应数据结构
          if (!result.data || !result.data.data || !result.data.data.notes || result.data.data.notes.length === 0) {
            console.log('没有更多数据，停止分页');
            break;
          }

        const notesList = result.data.data.notes;

        // 添加当前页数据
        allData.push(...notesList);
        console.log(`第 ${currentPage} 页获取到 ${notesList.length} 条数据`);

        // 检查是否有下一页 - 使用最后一条数据的cursor
        if (notesList.length > 0) {
          const lastNote = notesList[notesList.length - 1];
          if (lastNote.cursor) {
            lastCursor = lastNote.cursor;
            hasNextPage = true;
            console.log(`更新 lastCursor 为: ${lastCursor}`);
          } else {
            hasNextPage = false;
            console.log('没有找到cursor，停止分页');
          }
        } else {
          hasNextPage = false;
        }

        // 如果设置了 startDate，检查是否应该停止分页
        if (this.options.startDate && !this.shouldContinueNextPage(notesList, this.options.startDate)) {
          console.log('达到时间边界，停止分页');
          break;
        }

        currentPage++;

          // 添加延迟避免请求过快
          if (hasNextPage) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          if (error instanceof InsufficientCreditsError) {
            return await this.handleInsufficientCredits(error, allData, currentPage, reportProgress);
          } else {
            // 其他错误，重新抛出
            throw error;
          }
        }

        currentPage++;
      }

      reportProgress(90, '正在格式化数据...');
      const formattedData = await this.formatData(allData);

      reportProgress(100, '数据提取完成');

      return {
        success: true,
        data: formattedData,
        totalCount: allData.length,
        platform: '小红书',
        extractType: this.extractType,
        message: `小红书主页数据提取成功，共获取 ${allData.length} 条数据（${currentPage - 1} 页）`,
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        message: error instanceof Error ? error.message : '小红书主页数据提取失败',
      };
    }
  }

  protected getApiEndpoint(): string {
    return '/xhs/user/notes';
  }

  protected getTypeDisplayName(data?: any[]): string {
    // 如果有数据，尝试获取作者名称
    if (data && data.length > 0) {
      const firstItem = data[0];
      const authorName = firstItem.作者 || firstItem.user?.nickname || '';
      if (authorName) {
        return `小红书主页_${authorName}`;
      }
    }
    return '小红书主页';
  }

  // 从URL中提取用户ID
  private extractUserIdFromUrl(url: string): string | null {
    // 小红书用户主页URL格式: https://www.xiaohongshu.com/user/profile/5b39ce9a11be1012ad37bbc0
    const userIdMatch = url.match(/\/user\/profile\/([a-f0-9]+)/i);
    if (userIdMatch) {
      return userIdMatch[1];
    }

    // 也支持直接传入用户ID
    if (/^[a-f0-9]{24}$/i.test(url)) {
      return url;
    }

    return null;
  }

  // 判断是否应该继续下一页
  private shouldContinueNextPage(notesList: any[], originalStartDate?: string): boolean {
    if (!notesList || notesList.length === 0) {
      return false;
    }

    // 如果没有设置原始的 startDate，继续下一页
    if (!originalStartDate) {
      return true;
    }

    const originalDate = new Date(originalStartDate);

    // 过滤出有有效时间戳的数据，并按时间排序（最新的在前）
    const validNotes = notesList
      .filter(note => note.create_time)
      .sort((a, b) => b.create_time - a.create_time);

    if (validNotes.length === 0) {
      console.log('当前页没有有效时间数据，继续下一页');
      return true;
    }

    // 检查最后一条数据的时间
    const lastNote = validNotes[validNotes.length - 1];
    const lastNoteDate = new Date(lastNote.create_time * 1000);

    const shouldStop = lastNoteDate <= originalDate;

    if (shouldStop) {
      console.log(`最后一条数据时间 ${lastNoteDate.toLocaleString()} 早于或等于 startDate (${originalStartDate})，停止分页`);
      return false;
    }

    console.log(`最后一条数据时间 ${lastNoteDate.toLocaleString()} 晚于 startDate，继续下一页`);
    return true;
  }

  protected async formatData(notesList: any[]): Promise<any[]> {
    // 如果设置了 startDate，过滤掉早于该日期的数据
    let filteredList = notesList;
    if (this.options.startDate) {
      const startDateTime = new Date(this.options.startDate);
      filteredList = notesList.filter(note => {
        if (!note.create_time) return true; // 保留没有时间戳的数据

        const noteDate = new Date(note.create_time * 1000);
        const shouldInclude = noteDate > startDateTime;

        if (!shouldInclude) {
          console.log(`过滤掉早于 startDate 的数据: ${formatTimestamp(note.create_time)} <= ${this.options.startDate}`);
        }

        return shouldInclude;
      });

      console.log(`startDate 过滤: 原始数据 ${notesList.length} 条，过滤后 ${filteredList.length} 条`);
    }

    const formattedItems = [];

    for (const note of filteredList) {
      // 基础数据
      const baseData: any = {
        平台: '小红书',
        笔记ID: note.id || '',
        标题: note.title || note.display_title || '',
        描述: note.desc || '',
        链接: note.share_url || `https://www.xiaohongshu.com/explore/${note.id}`,
        发布时间: formatTimestamp(note.create_time),
        点赞数: note.likes?.toLocaleString() || 0,
        评论数: note.comments_count?.toLocaleString() || 0,
        分享数: note.share_count?.toLocaleString() || 0,
        收藏数: note.collected_count?.toLocaleString() || 0,
        作者: note.user?.nickname || '',
        作者ID: note.user?.userid || '',
        作者头像: await ProxyUtils.smartProxyUrl(note.user?.images, 'xhs') || '',
        笔记类型: note.type || '',
        地理位置: note.ip_location || '',
        话题: this.extractTopics(note.desc),
        图片信息: await this.formatImageInfo(note.images_list),
        视频时长: note.video_info_v2?.media?.video?.duration ? formatDuration(note.video_info_v2.media.video.duration) : '',
        视频封面: note.video_info_v2?.image?.first_frame ? await ProxyUtils.smartProxyUrl(note.video_info_v2.image.first_frame, 'xhs') : '',
        字幕信息: await this.formatSubtitleInfo(note.id, note.video_info_v2?.media?.video?.subtitles),
      };

      // 初始化所有支持的分辨率列为空字符串
      ResolutionUtils.supportedResolutions.forEach(resolution => {
        baseData[`视频分辨率_${resolution}`] = '';
      });

      // 处理视频流信息，提取不同分辨率的视频链接
      if (note.video_info_v2?.media?.stream) {
        const stream = note.video_info_v2.media.stream;

        // 处理不同编码格式的视频流
        const streamTypes = ['h264', 'h265', 'h266', 'av1'];

        for (const streamType of streamTypes) {
          if (stream[streamType] && Array.isArray(stream[streamType])) {
            for (const streamItem of stream[streamType]) {
              if (streamItem.master_url && streamItem.width && streamItem.height) {
                // 使用ResolutionUtils标准化分辨率
                const rawResolution = `${streamItem.width}x${streamItem.height}`;
                const standardResolution = ResolutionUtils.normalizeResolution(rawResolution);

                if (standardResolution) {
                  const columnName = `视频分辨率_${standardResolution}`;

                  // 只有在还没有设置该分辨率时才设置，优先使用更好的编码格式
                  if (!baseData[columnName]) {
                    const proxyUrl = await ProxyUtils.smartProxyUrl(streamItem.master_url, 'xhs');
                    baseData[columnName] = proxyUrl;
                  }
                }
              }
            }
          }
        }
      }
      baseData['提取时间'] = Date.now();

      formattedItems.push(baseData);
    }

    return formattedItems;
  }

  // 提取话题标签
  private extractTopics(desc: string): string {
    if (!desc) return '';

    // 匹配 #话题[话题]# 格式
    const topicMatches = desc.match(/#([^#\[\]]+)\[话题\]#/g);
    if (topicMatches) {
      return topicMatches.map(match => {
        const topic = match.replace(/#([^#\[\]]+)\[话题\]#/, '$1');
        return topic;
      }).join(', ');
    }

    return '';
  }

  // 格式化图片信息
  private async formatImageInfo(imagesList: any[]): Promise<string> {
    if (!imagesList || !Array.isArray(imagesList) || imagesList.length === 0) {
      return '';
    }

    const imageDetails = [];

    for (const image of imagesList) {
      const details: string[] = [];

      if (image.width && image.height) {
        details.push(`尺寸: ${image.width}x${image.height}`);
      }

      if (image.url_size_large) {
        const proxyUrl = await ProxyUtils.smartProxyUrl(image.url_size_large, 'xhs');
        details.push(`图片链接: ${proxyUrl}`);
      }

      imageDetails.push(details.join(', '));
    }

    return imageDetails.join(' | ');
  }



  // 格式化字幕信息
  private async formatSubtitleInfo(noteId: string, subtitles: any): Promise<string> {
    if (!subtitles || typeof subtitles !== 'object') {
      return '';
    }

    const subtitleDetails = [];

    // 遍历不同语言的字幕
    for (const [language, subtitleList] of Object.entries(subtitles)) {
      if (Array.isArray(subtitleList)) {
        for (const subtitle of subtitleList) {
          const details: string[] = [];

          if (subtitle.language) {
            details.push(`语言: ${subtitle.language}`);
          }

          if (subtitle.format !== undefined) {
            const format = subtitle.format === 0 ? 'SRT' : 'Unknown';
            details.push(`格式: ${format}`);
          }
          if (subtitle.url) {
            const proxyUrl = await ProxyUtils.buildDownloadProxyUrl(
              subtitle.url,
              3600,
              'xhs',
              '',
              `${noteId}_${subtitle.language}.srt`
            );
            details.push(`链接: ${proxyUrl}`);
          }

          subtitleDetails.push(details.join(', '));
        }
      }
    }

    return subtitleDetails.join(' | ');
  }
}
