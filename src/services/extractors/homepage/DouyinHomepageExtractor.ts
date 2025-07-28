import { formatDuration, formatTimestamp } from '../../../lib/utils';
import { BasePlatformExtractor, Platform, ExtractOptions, ExtractResult, InsufficientCreditsError } from '../../DataExtractor';
import { ResolutionUtils } from '../../../lib/ResolutionUtils';

export class DouyinHomepageExtractor extends BasePlatformExtractor {
  protected platform: Platform = 'douyin';
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

      reportProgress(0, '开始抖音主页数据提取...');

      // 需要分页的情况
      const allData: any[] = [];
      let currentPage = 1;
      let hasNextPage = true;
      let maxCursor: number | undefined = undefined;
      const maxPages = this.options.range === 'all' ? 100 : (this.options.range as number); // 设置最大页数限制

      while (hasNextPage && currentPage <= maxPages) {
        const pageProgress = ((currentPage - 1) / maxPages) * 90; // 90%用于分页进度
        reportProgress(pageProgress, `正在提取第 ${currentPage} 页数据...`);
        console.log(`正在提取第 ${currentPage} 页数据...`);

        // 构建当前页的请求负载，包含 maxCursor 用于翻页
        const payload: any = {
          url,
        };

        // 如果有 maxCursor，添加到请求中用于翻页
        if (maxCursor !== undefined) {
          payload.maxCursor = maxCursor;
        }

        try {
          const endpoint = this.getApiEndpoint();
          const result = await this.makeRequest(endpoint, payload);

          // 检查响应数据结构
          if (!result.data || !result.data.aweme_list || result.data.aweme_list.length === 0) {
            console.log('没有更多数据，停止分页');
            break;
          }

        const awemeList = result.data.aweme_list;

        // 添加当前页数据
        allData.push(...awemeList);
        console.log(`第 ${currentPage} 页获取到 ${awemeList.length} 条数据`);

        // 检查是否有下一页
        hasNextPage = result.data.has_more === 1;

        // 更新 maxCursor 用于下一页请求
        if (hasNextPage && result.data.max_cursor) {
          maxCursor = result.data.max_cursor;
          console.log(`更新 maxCursor 为: ${maxCursor}`);
        }

        // 如果设置了 startDate，检查是否应该停止分页
        if (this.options.startDate && !this.shouldContinueNextPage(awemeList, this.options.startDate)) {
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
        platform: '抖音',
        extractType: this.extractType,
        message: `抖音主页数据提取成功，共获取 ${allData.length} 条数据（${currentPage - 1} 页）`,
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        message: error instanceof Error ? error.message : '主页数据提取失败',
      };
    }
  }

  protected getApiEndpoint(): string {
    return '/dy/user/videos';
  }

  protected getTypeDisplayName(data?: any[]): string {
    // 如果有数据，尝试获取作者名称
    if (data && data.length > 0) {
      const firstItem = data[0];
      const authorName = firstItem.作者 || firstItem.author?.nickname || '';
      if (authorName) {
        return `抖音主页_${authorName}`;
      }
    }
    return '抖音主页';
  }

  // 判断是否应该继续下一页
  private shouldContinueNextPage(awemeList: any[], originalStartDate?: string): boolean {
    if (!awemeList || awemeList.length === 0) {
      return false;
    }

    // 如果没有设置原始的 startDate，继续下一页
    if (!originalStartDate) {
      return true;
    }

    const originalDate = new Date(originalStartDate);

    // 过滤掉置顶内容，只检查非置顶的正常内容
    const nonTopAwemes = awemeList.filter(aweme =>
      aweme.create_time && !aweme.is_top
    );

    if (nonTopAwemes.length === 0) {
      console.log('当前页没有非置顶的有效时间数据，继续下一页');
      return true;
    }

    // 按时间排序（最新的在前）
    nonTopAwemes.sort((a, b) => b.create_time - a.create_time);

    // 检查最后一条非置顶数据的时间
    const lastItem = nonTopAwemes[nonTopAwemes.length - 1];
    const lastItemDate = new Date(lastItem.create_time * 1000);

    const shouldStop = lastItemDate <= originalDate;

    if (shouldStop) {
      console.log(`最后一条非置顶数据时间 ${lastItemDate.toLocaleString()} 早于或等于 startDate (${originalStartDate})，停止分页`);
      return false;
    }

    console.log(`最后一条非置顶数据时间 ${lastItemDate.toLocaleString()} 晚于 startDate，继续下一页`);
    return true;
  }

  protected async formatData(awemeList: any[]): Promise<any[]> {
    // 如果设置了 startDate，过滤掉早于该日期的数据
    let filteredList = awemeList;
    if (this.options.startDate) {
      const startDateTime = new Date(this.options.startDate);
      filteredList = awemeList.filter(aweme => {
        if (!aweme.create_time) return true; // 保留没有时间戳的数据

        const itemDate = new Date(aweme.create_time * 1000);
        const shouldInclude = itemDate > startDateTime;

        if (!shouldInclude) {
          console.log(`过滤掉早于 startDate 的数据: ${formatTimestamp(aweme.create_time)} <= ${this.options.startDate}`);
        }

        return shouldInclude;
      });

      console.log(`startDate 过滤: 原始数据 ${awemeList.length} 条，过滤后 ${filteredList.length} 条`);
    }

    return filteredList.map(aweme => {
      // 基础数据
      const baseData: any = {
        平台: '抖音',
        视频ID: aweme.aweme_id || '',
        描述: aweme.desc || '',
        链接: `https://www.douyin.com/video/${aweme.aweme_id}` || '',
        发布时间: formatTimestamp(aweme.create_time),
        点赞数: aweme.statistics?.digg_count.toLocaleString() || 0,
        评论数: aweme.statistics?.comment_count.toLocaleString() || 0,
        分享数: aweme.statistics?.share_count.toLocaleString() || 0,
        推荐数: aweme.statistics?.recommend_count.toLocaleString() || 0,
        收藏数: aweme.statistics?.collect_count.toLocaleString() || 0,
        作者: aweme.author?.nickname || '',
        作者头像: aweme.author?.avatar_thumb?.url_list?.[0] || '',
        视频时长: aweme.video?.duration ? formatDuration(Number(aweme.video?.duration) / 1000) : '',
        视频封面: aweme.video?.cover?.url_list?.[0] || '',
        音乐标题: aweme.music?.title || '',
        音乐作者: aweme.music?.author || '',
        音乐链接: aweme.music?.play_url?.url_list?.[0] || '',
        话题: aweme.text_extra?.filter((item: any) => item.hashtag_name)
          .map((item: any) => item.hashtag_name).join(', ') || '',
        标签: aweme.video_tag?.map((tag: any) => tag.tag_name).join(', ') || '',
      };

      // 初始化所有支持的分辨率列为空字符串
      ResolutionUtils.supportedResolutions.forEach(resolution => {
        baseData[`视频分辨率_${resolution}`] = '';
      });

      // 处理 bit_rate 数组，提取不同分辨率的视频链接
      if (aweme.video?.bit_rate && Array.isArray(aweme.video.bit_rate)) {
        aweme.video.bit_rate.forEach((bitRateItem: any) => {
          if (bitRateItem.play_addr) {
            const width = bitRateItem.play_addr.width;
            const height = bitRateItem.play_addr.height;

            if (width && height) {
              // 使用ResolutionUtils标准化分辨率
              const rawResolution = `${width}x${height}`;
              const standardResolution = ResolutionUtils.normalizeResolution(rawResolution);

              if (standardResolution) {
                const columnName = `视频分辨率_${standardResolution}`;

                // 查找 www.douyin.com 域名的播放地址
                if (bitRateItem.play_addr.url_list && Array.isArray(bitRateItem.play_addr.url_list)) {
                  const douyinUrl = bitRateItem.play_addr.url_list.find((url: string) =>
                    url.includes('www.douyin.com')
                  );

                  if (douyinUrl) {
                    // 只有在找到抖音链接时才设置，避免覆盖已有的链接
                    if (!baseData[columnName]) {
                      baseData[columnName] = douyinUrl;
                    }
                  }
                }
              }
            }
          }
        });
      }

      // 在最后添加提取时间字段，使用当前时间戳（CreatedTime字段会自动处理）
      baseData['提取时间'] = Date.now();

      return baseData;
    });
  }
}
