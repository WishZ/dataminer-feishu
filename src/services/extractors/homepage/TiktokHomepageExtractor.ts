import { formatDuration, formatTimestamp } from '../../../lib/utils';
import { BasePlatformExtractor, Platform, ExtractOptions, ExtractResult, InsufficientCreditsError } from '../../DataExtractor';
import { ResolutionUtils } from '../../../lib/ResolutionUtils';
import { ProxyUtils } from '../../../lib/ProxyUtils';

export class TiktokHomepageExtractor extends BasePlatformExtractor {
  protected platform: Platform = 'tiktok';
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
      let cursor: string | undefined = undefined;
      const maxPages = this.options.range === 'all' ? 100 : (this.options.range as number);

      //需要先调用用户详情API
      const userInfoEndpoint = '/tiktok/user/info';
      const userInfoPayload = { url };
      const userInfoResult = await this.makeRequest(userInfoEndpoint, userInfoPayload);
      const userInfo = userInfoResult.data.userInfo;
      const authorName = userInfo.user?.nickname || '';
      if (authorName) {
        reportProgress(5, `正在提取${authorName}的主页数据...`);
      }

      while (hasNextPage && currentPage <= maxPages) {
        const pageProgress = ((currentPage - 1) / maxPages) * 90;
        reportProgress(pageProgress, `正在提取第 ${currentPage} 页数据...`);
        console.log(`正在提取第 ${currentPage} 页数据...`);

        // 构建当前页的请求负载
        const payload: any = {
          secUserId: userInfo.user?.secUid,
        };

        // 如果有 cursor，添加到请求中用于翻页（第一页不需要 cursor）
        if (cursor !== undefined && currentPage > 1) {
          payload.cursor = cursor;
          console.log(`使用 cursor 进行翻页: ${cursor}`);
        }

        try {
          const endpoint = this.getApiEndpoint();
          const result = await this.makeRequest(endpoint, payload);

          // 检查响应数据结构
          if (!result.data || !result.data.itemList || result.data.itemList.length === 0) {
            console.log('没有更多数据，停止分页');
            break;
          }

        const itemList = result.data.itemList;

        // 添加当前页数据
        allData.push(...itemList);
        console.log(`第 ${currentPage} 页获取到 ${itemList.length} 条数据`);

        // 检查是否有下一页
        hasNextPage = result.data.hasMorePrevious === true;

        // 更新 cursor 用于下一页请求 - 使用当前页最后一条数据的 createTime
        if (hasNextPage && itemList.length > 0) {
          const lastItem = itemList[itemList.length - 1];
          if (lastItem.createTime) {
            cursor = lastItem.createTime.toString();
            console.log(`更新 cursor 为最后一条数据的 createTime: ${cursor}`);
          }
        }

        // 如果设置了 startDate，检查是否应该停止分页
        if (this.options.startDate && !this.shouldContinueNextPage(itemList, this.options.startDate)) {
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
        platform: 'TikTok',
        extractType: this.extractType,
        message: `TikTok主页数据提取成功，共获取 ${allData.length} 条数据（${currentPage - 1} 页）`,
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        message: error instanceof Error ? error.message : 'TikTok主页数据提取失败',
      };
    }
  }

  protected getApiEndpoint(): string {
    return '/tiktok/user/posts';
  }

  protected getTypeDisplayName(data?: any[]): string {
    // 如果有数据，尝试获取作者名称
    if (data && data.length > 0) {
      const firstItem = data[0];
      const authorName = firstItem.作者 || firstItem.author?.nickname || '';
      if (authorName) {
        return `TikTok主页_${authorName}`;
      }
    }
    return 'TikTok主页';
  }

  // 判断是否应该继续下一页
  private shouldContinueNextPage(itemList: any[], originalStartDate?: string): boolean {
    if (!itemList || itemList.length === 0) {
      return false;
    }

    // 如果没有设置原始的 startDate，继续下一页
    if (!originalStartDate) {
      return true;
    }

    const originalDate = new Date(originalStartDate);

    // 过滤出有有效时间戳的数据，并按时间排序（最新的在前）
    const validItems = itemList
      .filter(item => item.createTime)
      .sort((a, b) => b.createTime - a.createTime);

    if (validItems.length === 0) {
      console.log('当前页没有有效时间数据，继续下一页');
      return true;
    }

    // 检查最后一条数据的时间
    const lastItem = validItems[validItems.length - 1];
    const lastItemDate = new Date(lastItem.createTime * 1000);

    const shouldStop = lastItemDate <= originalDate;

    if (shouldStop) {
      console.log(`最后一条数据时间 ${lastItemDate.toLocaleString()} 早于或等于 startDate (${originalStartDate})，停止分页`);
      return false;
    }

    console.log(`最后一条数据时间 ${lastItemDate.toLocaleString()} 晚于 startDate，继续下一页`);
    return true;
  }

  protected async formatData(itemList: any[]): Promise<any[]> {
    // 如果设置了 startDate，过滤掉早于该日期的数据
    let filteredList = itemList;
    if (this.options.startDate) {
      const startDateTime = new Date(this.options.startDate);
      filteredList = itemList.filter(item => {
        if (!item.createTime) return true; // 保留没有时间戳的数据

        const itemDate = new Date(item.createTime * 1000);
        const shouldInclude = itemDate > startDateTime;

        if (!shouldInclude) {
          console.log(`过滤掉早于 startDate 的数据: ${formatTimestamp(item.createTime)} <= ${this.options.startDate}`);
        }

        return shouldInclude;
      });

      console.log(`startDate 过滤: 原始数据 ${itemList.length} 条，过滤后 ${filteredList.length} 条`);
    }

    const formattedItems = [];

    for (const item of filteredList) {
      // 基础数据
      const baseData: any = {
        平台: 'TikTok',
        视频ID: item.id || '',
        描述: item.desc || '',
        链接: `https://www.tiktok.com/@${item.author?.uniqueId}/video/${item.id}` || '',
        发布时间: formatTimestamp(item.createTime),
        点赞数: item.stats?.diggCount?.toLocaleString() || item.statsV2?.diggCount || 0,
        评论数: item.stats?.commentCount?.toLocaleString() || item.statsV2?.commentCount || 0,
        分享数: item.stats?.shareCount?.toLocaleString() || item.statsV2?.shareCount || 0,
        播放数: item.stats?.playCount?.toLocaleString() || item.statsV2?.playCount || 0,
        收藏数: item.stats?.collectCount?.toLocaleString() || item.statsV2?.collectCount || 0,
        作者: item.author?.nickname || '',
        作者头像: item.author?.avatarThumb || '',
        粉丝数: item.authorStats?.followerCount?.toLocaleString() || item.authorStatsV2?.followerCount || 0,
        关注数: item.authorStats?.followingCount?.toLocaleString() || item.authorStatsV2?.followingCount || 0,
        获赞总数: item.authorStats?.heartCount?.toLocaleString() || item.authorStatsV2?.heartCount || 0,
        视频数量: item.authorStats?.videoCount?.toLocaleString() || item.authorStatsV2?.videoCount || 0,
        视频时长: item.video?.duration ? formatDuration(item.video.duration) : '',
        视频封面: item.video?.cover || '',
        音乐标题: item.music?.title || '',
        音乐作者: item.music?.authorName || '',
        音乐链接: await ProxyUtils.smartProxyUrl(item.music?.playUrl, 'tiktok') || '',
        话题: this.extractHashtags(item),
        语言: item.textLanguage || '',
        字幕信息: await this.formatSubtitleInfo(item.id, item.video?.subtitleInfos),
      };
      baseData['提取时间'] = Date.now();

      formattedItems.push(baseData);
    }

    return formattedItems;
  }

  // 提取话题标签
  private extractHashtags(item: any): string {
    const hashtags: string[] = [];

    // 从 challenges 中提取
    if (item.challenges && Array.isArray(item.challenges)) {
      hashtags.push(...item.challenges.map((challenge: any) => challenge.title).filter(Boolean));
    }

    // 从 textExtra 中提取
    if (item.textExtra && Array.isArray(item.textExtra)) {
      hashtags.push(...item.textExtra
        .filter((extra: any) => extra.type === 1 && extra.hashtagName)
        .map((extra: any) => extra.hashtagName)
      );
    }

    return [...new Set(hashtags)].join(', '); // 去重并连接
  }

  // 格式化字幕信息
  private async formatSubtitleInfo(itemId: string, subtitleInfos: any[]): Promise<string> {
    if (!subtitleInfos || !Array.isArray(subtitleInfos) || subtitleInfos.length === 0) {
      return '';
    }

    const subtitleDetails = [];

    for (const subtitle of subtitleInfos) {
      const details: string[] = [];

      // 语言信息
      if (subtitle.LanguageCodeName) {
        details.push(`语言: ${subtitle.LanguageCodeName}`);
      }

      // 格式信息
      if (subtitle.Format) {
        details.push(`格式: ${subtitle.Format}`);
      }

      // 字幕链接（使用异步代理处理）
      if (subtitle.Url) {
        const subtitleUrl = await ProxyUtils.buildDownloadProxyUrl(subtitle.Url, 3600, 'tiktok', '', itemId + '_' + subtitle.LanguageCodeName + '.' + subtitle.Format) || '';
        details.push(`链接: ${subtitleUrl}`);
      }

      subtitleDetails.push(details.join(', '));
    }

    return subtitleDetails.join(' | ');
  }
}
