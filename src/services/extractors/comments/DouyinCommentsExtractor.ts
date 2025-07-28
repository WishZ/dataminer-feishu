import { formatTimestamp } from '../../../lib/utils';
import { BasePlatformExtractor, Platform, ExtractOptions, ExtractResult, InsufficientCreditsError } from '../../DataExtractor';
import { ProxyUtils } from '../../../lib/ProxyUtils';

export class DouyinCommentsExtractor extends BasePlatformExtractor {
  protected platform: Platform = 'douyin';
  protected extractType = 'comments';

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

      reportProgress(0, '开始提取评论数据...');

      let allComments: any[] = [];
      let currentPage = 1;
      let hasNextPage = true;
      let cursor: string | undefined = undefined;
      const maxPages = this.options.range as number;
      const seenCommentIds = new Set<string>(); // 用于去重的评论ID集合

      // 提取评论数据
      while (hasNextPage && currentPage <= maxPages) {
        const pageProgress = ((currentPage - 1) / maxPages) * 80;
        reportProgress(pageProgress, `正在提取第 ${currentPage} 页评论...`);
        console.log(`正在提取第 ${currentPage} 页评论...`);

        try {
          // 构建评论请求负载
          const payload: any = {
            url,
          };

          if (cursor) {
            payload.cursor = cursor;
          }

          const endpoint = this.getApiEndpoint();
          const result = await this.makeRequest(endpoint, payload);

          // 检查响应数据结构
          if (!result.data?.comments || result.data.comments.length === 0) {
            console.log('没有更多评论数据，停止分页');
            break;
          }

          const commentsList = result.data.comments;

          // 去重处理：只添加未见过的评论
          const newComments = commentsList.filter((comment: any) => {
            if (!comment.cid) return false; // 没有ID的评论跳过

            if (seenCommentIds.has(comment.cid)) {
              console.log(`跳过重复评论: ${comment.cid}`);
              return false;
            }

            seenCommentIds.add(comment.cid);
            return true;
          });

          allComments.push(...newComments);
          console.log(`第 ${currentPage} 页获取到 ${commentsList.length} 条评论，去重后添加 ${newComments.length} 条`);

          // 检查是否有下一页
          if (result.data.has_more === 1 && result.data.cursor) {
            cursor = result.data.cursor.toString();
            hasNextPage = true;
            console.log(`更新 cursor 为: ${cursor}`);
          } else {
            hasNextPage = false;
            console.log('没有更多页面');
          }

          // 如果开启了包含回复选项，提取回复数据
          if (this.options.includeReplies) {
            try {
              await this.extractReplies(commentsList, reportProgress);
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
        platform: '抖音',
        extractType: this.extractType,
        message: `抖音评论数据提取成功，共获取 ${allComments.length} 条评论（${currentPage - 1} 页）`,
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        message: error instanceof Error ? error.message : '抖音评论数据提取失败',
      };
    }
  }

  protected getApiEndpoint(): string {
    return '/dy/video/comments';
  }

  protected getTypeDisplayName(): string {
    return '抖音评论';
  }

  // 提取回复数据
  private async extractReplies(commentsList: any[], reportProgress?: (progress: number, message: string) => void): Promise<void> {
    const seenReplyIds = new Set<string>(); // 用于去重的回复ID集合

    for (const comment of commentsList) {
      // 检查评论是否有回复，使用正确的字段名
      if (comment.reply_comment_total > 0) {
        try {
          console.log(`正在提取评论 ${comment.cid} 的回复，预计 ${comment.reply_comment_total} 条...`);

          const repliesPayload = {
            aweme_id: comment.aweme_id,
            comment_id: comment.cid,
          };

          const repliesResult = await this.makeRequest('/dy/comment/replies', repliesPayload);

          // 检查回复数据结构
          if (repliesResult.data?.comments) {
            const replies = repliesResult.data.comments;

            // 去重处理：只添加未见过的回复
            const newReplies = replies.filter((reply: any) => {
              if (!reply.cid) return false; // 没有ID的回复跳过

              if (seenReplyIds.has(reply.cid)) {
                console.log(`跳过重复回复: ${reply.cid}`);
                return false;
              }

              seenReplyIds.add(reply.cid);
              return true;
            });

            console.log(`获取到 ${replies.length} 条回复，去重后添加 ${newReplies.length} 条`);

            // 将去重后的回复添加到评论的replies中
            if (!comment.replies) {
              comment.replies = [];
            }
            comment.replies.push(...newReplies);
          } else {
            console.log(`评论 ${comment.cid} 的回复数据结构异常`);
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
            console.error(`提取评论 ${comment.cid} 的回复失败:`, error);
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
      if (this.options.includeReplies && comment.replies && comment.replies.length > 0) {
        for (const reply of comment.replies) {
          const formattedReply = await this.formatComment(reply, '回复', comment.cid);
          formattedItems.push(formattedReply);
        }
      }
    }

    return formattedItems;
  }

  // 格式化单条评论或回复
  private async formatComment(comment: any, type: string, parentCommentId?: string): Promise<any> {
    // 获取头像URL，优先使用avatar_thumb
    let avatarUrl = '';
    if (comment.user?.avatar_thumb?.url_list && comment.user.avatar_thumb.url_list.length > 0) {
      avatarUrl = await ProxyUtils.smartProxyUrl(comment.user.avatar_thumb.url_list[0], 'douyin');
    } else if (comment.user?.avatar_medium?.url_list && comment.user.avatar_medium.url_list.length > 0) {
      avatarUrl = await ProxyUtils.smartProxyUrl(comment.user.avatar_medium.url_list[0], 'douyin');
    }

    const formattedComment = {
      平台: '抖音',
      评论类型: type,
      评论ID: comment.cid || '',
      父评论ID: parentCommentId || '',
      视频ID: comment.aweme_id || '',
      作者ID: comment.user?.uid || '',
      作者昵称: comment.user?.nickname || '',
      作者头像: avatarUrl,
      评论内容: comment.text || '',
      发布时间: formatTimestamp(comment.create_time),
      点赞数: comment.digg_count || 0,
      回复数量: comment.reply_comment_total || 0,
      IP归属地: comment.ip_label || '',
      回复目标ID: comment.reply_to_reply_id || '',
      提取时间: Date.now(),
    };

    return formattedComment;
  }
}
