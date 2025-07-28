import { formatTimestamp } from '../../../lib/utils';
import { BasePlatformExtractor, Platform, ExtractOptions, ExtractResult, InsufficientCreditsError } from '../../DataExtractor';
import { ProxyUtils } from '../../../lib/ProxyUtils';

export class KuaishouCommentsExtractor extends BasePlatformExtractor {
  protected platform: Platform = 'kuaishou';
  protected extractType = 'comments';

  constructor(options: ExtractOptions) {
    super(options);
  }

  async extract(url: string): Promise<ExtractResult> {
    console.info(this.options)
    try {
      // 进度回调辅助函数
      const reportProgress = (progress: number, message: string) => {
        if (this.options.onProgress && typeof this.options.onProgress === 'function') {
          this.options.onProgress(progress, message);
        }
      };

      reportProgress(0, '开始提取评论数据...');

      // 解析URL获取photoId和authorId
      const { photoId, authorId } = await this.parseVideoUrl(url);

      let allComments: any[] = [];
      let currentPage = 1;
      let hasNextPage = true;
      let pcursor: string | undefined = undefined;
      const maxPages = this.options.range as number;

      // 提取评论数据
      while (hasNextPage && currentPage <= maxPages) {
        const pageProgress = ((currentPage - 1) / maxPages) * 80;
        reportProgress(pageProgress, `正在提取第 ${currentPage} 页评论...`);
        console.log(`正在提取第 ${currentPage} 页评论...`);

        try {
          // 构建评论请求负载
          const payload: any = {
            photoId,
            authorId,
          };

          if (pcursor) {
            payload.pcursor = pcursor;
          }

          const endpoint = this.getApiEndpoint();
          const result = await this.makeRequest(endpoint, payload);

          // 检查响应数据结构
          if (!result.data?.data?.visionCommentList?.rootComments || result.data.data.visionCommentList.rootComments.length === 0) {
            console.log('没有更多评论数据，停止分页');
            break;
          }

          const commentsList = result.data.data.visionCommentList.rootComments;
          allComments.push(...commentsList);
          console.log(`第 ${currentPage} 页获取到 ${commentsList.length} 条评论`);

          // 检查是否有下一页
          if (result.data.data.visionCommentList.pcursor) {
            pcursor = result.data.data.visionCommentList.pcursor;
            hasNextPage = true;
            console.log(`更新 pcursor 为: ${pcursor}`);
          } else {
            hasNextPage = false;
            console.log('没有更多页面');
          }

          // 如果开启了包含回复选项，提取回复数据
          if (this.options.includeReplies) {
            try {
              await this.extractReplies(commentsList, photoId, authorId, reportProgress);
            } catch (replyError) {
              if (replyError instanceof InsufficientCreditsError) {
                // 回复提取时积分不足，返回已获取的评论数据
                console.log('回复提取时积分不足，返回已获取的评论数据');
                return await this.handleInsufficientCredits(replyError, allComments, currentPage, reportProgress);
              } else {
                // 其他回复提取错误，记录日志但继续主流程
                console.error('回复提取失败，继续主评论提取:', replyError);
              }
            }
          }

        } catch (error) {
          if (error instanceof InsufficientCreditsError) {
            return await this.handleInsufficientCredits(error, allComments, currentPage, reportProgress);
          } else {
            throw error;
          }
        }

        currentPage++;

        // 添加延迟避免请求过快
        if (hasNextPage) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      reportProgress(90, '正在格式化数据...');
      const formattedData = await this.formatData(allComments);

      reportProgress(100, '评论数据提取完成');

      return {
        success: true,
        data: formattedData,
        totalCount: allComments.length,
        platform: '快手',
        extractType: this.extractType,
        message: `快手评论数据提取成功，共获取 ${allComments.length} 条评论（${currentPage - 1} 页）`,
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        message: error instanceof Error ? error.message : '快手评论数据提取失败',
      };
    }
  }

  protected getApiEndpoint(): string {
    return '/kuaishou/comments';
  }

  protected getTypeDisplayName(): string {
    return '快手评论';
  }

  // 解析视频URL获取photoId和authorId
  private async parseVideoUrl(url: string): Promise<{ photoId: string; authorId: string }> {
    try {
      const urlObj = new URL(url);

      // 从路径中提取photoId (short-video/photoId)
      const pathMatch = urlObj.pathname.match(/\/short-video\/([^\/]+)/);
      const photoId = pathMatch ? pathMatch[1] : '';

      // 从查询参数中提取authorId
      const authorId = urlObj.searchParams.get('authorId') || '';

      if (photoId && authorId) {
        return { photoId, authorId };
      }

      // URL中参数不完整，调用详情接口
      console.log('URL中参数不完整，调用详情接口获取完整信息');
      const detailResponse = await this.makeRequest('/kuaishou/video/detail', { url: url.trim() });

      if (!detailResponse.success || !detailResponse.data?.photo?.share_info) {
        throw new Error('获取视频详情失败，无法解析视频信息');
      }

      const parsedInfo = this.parseShareInfo(detailResponse.data.photo.share_info);
      if (!parsedInfo.photoId || !parsedInfo.authorId) {
        throw new Error('无法从视频详情中解析出photoId和authorId');
      }

      return parsedInfo;
    } catch (error) {
      throw new Error(`解析视频URL失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  // 解析share_info获取photoId和authorId
  private parseShareInfo(shareInfo: string): { photoId: string; authorId: string } {
    const params = new URLSearchParams(shareInfo);
    return {
      photoId: params.get('photoId') || '',
      authorId: params.get('userId') || ''
    };
  }

  // 提取回复数据
  private async extractReplies(commentsList: any[], photoId: string, authorId: string, reportProgress?: (progress: number, message: string) => void): Promise<void> {
    for (const comment of commentsList) {
      if (comment.subCommentCount > 0 && comment.subCommentsPcursor && comment.subCommentsPcursor !== 'no_more') {
        try {
          console.log(`正在提取评论 ${comment.commentId} 的回复...`);

          const repliesPayload = {
            photoId,
            authorId,
            rootCommentId: comment.commentId,
            pcursor: comment.subCommentsPcursor
          };

          const repliesResult = await this.makeRequest('/kuaishou/replies', repliesPayload);

          if (repliesResult.data?.data?.visionSubCommentList?.subComments) {
            const replies = repliesResult.data.data.visionSubCommentList.subComments;
            console.log(`获取到 ${replies.length} 条回复`);

            // 将回复添加到评论的subComments中
            if (!comment.subComments) {
              comment.subComments = [];
            }
            comment.subComments.push(...replies);
          }

          // 添加延迟避免请求过快
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          if (error instanceof InsufficientCreditsError) {
            // 积分不足时，向上抛出错误，让主流程处理
            console.log(`提取回复时积分不足，停止回复提取`);
            throw error;
          } else {
            // 其他错误只记录日志，继续处理其他评论的回复
            console.error(`提取评论 ${comment.commentId} 的回复失败:`, error);
          }
        }
      }
    }
  }

  protected async formatData(commentsList: any[]): Promise<any[]> {
    const formattedItems = [];

    for (const comment of commentsList) {
      // 格式化主评论
      const mainComment = await this.formatComment(comment, '主评论');
      formattedItems.push(mainComment);

      // 如果有回复且用户选择包含回复，格式化回复
      if (this.options.includeReplies && comment.subComments && comment.subComments.length > 0) {
        for (const reply of comment.subComments) {
          const formattedReply = await this.formatComment(reply, '回复', comment.commentId);
          formattedItems.push(formattedReply);
        }
      }
    }

    return formattedItems;
  }

  // 格式化单条评论或回复
  private async formatComment(comment: any, type: string, parentCommentId?: string): Promise<any> {
    return {
      平台: '快手',
      评论类型: type,
      评论ID: comment.commentId || '',
      父评论ID: parentCommentId || '',
      作者ID: comment.authorId || '',
      作者昵称: comment.authorName || '',
      作者头像: comment.headurl ? await ProxyUtils.smartProxyUrl(comment.headurl, 'kuaishou') : '',
      评论内容: comment.content || '',
      发布时间: formatTimestamp(Math.floor(comment.timestamp / 1000)),
      点赞数: comment.likedCount || 0,
      真实点赞数: comment.realLikedCount || 0,
      作者是否点赞: comment.authorLiked || false,
      回复目标用户: comment.replyToUserName || '',
      回复目标ID: comment.replyTo || '',
      子评论数量: comment.subCommentCount || 0,
      提取时间: Date.now(),
    };
  }
}
