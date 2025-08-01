import { XhsDetailsExtractor } from '../../src/services/extractors/details/XhsDetailsExtractor';
import { ExtractOptions } from '../../src/services/DataExtractor';
import fs from 'fs';
import path from 'path';

describe('XhsDetailsExtractor', () => {
  let extractor: XhsDetailsExtractor;
  let mockOptions: ExtractOptions;

  beforeEach(() => {
    mockOptions = {
      apiKey: 'test-api-key',
      onProgress: jest.fn(),
    };
    extractor = new XhsDetailsExtractor(mockOptions);
  });

  describe('formatData', () => {
    it('should format XHS note detail data correctly', async () => {
      // 读取测试数据
      const testDataPath = path.join(__dirname, '../data/xhs/noteDetail.json');
      const testData = JSON.parse(fs.readFileSync(testDataPath, 'utf-8'));
      
      // 提取实际的数据部分
      const dataList = testData.data.data;
      
      // 调用 formatData 方法
      const result = await (extractor as any).formatData(dataList);
      
      // 验证结果
      expect(result).toHaveLength(1);
      
      const formattedNote = result[0];
      
      // 验证基础信息
      expect(formattedNote.平台).toBe('小红书');
      expect(formattedNote.笔记ID).toBe('68183769000000002301d33a');
      expect(formattedNote.标题).toBe('618抄作业！2025年养猫囤货清单来袭');
      expect(formattedNote.笔记类型).toBe('note');
      
      // 验证作者信息
      expect(formattedNote.作者ID).toBe('6275dd6b000000001000c833');
      expect(formattedNote.作者昵称).toBe('蔚时');
      expect(formattedNote.是否关注).toBe(false);
      
      // 验证统计数据
      expect(formattedNote.点赞数).toBe('499');
      expect(formattedNote.收藏数).toBe('342');
      expect(formattedNote.评论数).toBe('20');
      expect(formattedNote.是否点赞).toBe(false);
      expect(formattedNote.是否收藏).toBe(false);
      expect(formattedNote.是否置顶).toBe(false);
      
      // 验证分享信息
      expect(formattedNote.分享链接).toBe('https://www.xiaohongshu.com/discovery/item/68183769000000002301d33a?share_from_user_hidden=true&type=normal');
      expect(formattedNote.分享标题).toBe('618抄作业！2025年养猫囤货清单来袭');
      
      // 验证图片信息
      expect(formattedNote.图片1).toBeDefined();
      expect(formattedNote['图片1_尺寸']).toBe('1155x2054');
      expect(formattedNote.图片2).toBeDefined();
      expect(formattedNote['图片2_尺寸']).toBe('1205x2143');
      
      // 验证媒体保存配置
      expect(formattedNote.禁止保存).toBe(false);
      expect(formattedNote.禁止水印).toBe(false);
      
      // 验证提取时间存在
      expect(formattedNote.提取时间).toBeDefined();
      expect(typeof formattedNote.提取时间).toBe('number');
    });

    it('should handle empty note list gracefully', async () => {
      const dataList = [{ note_list: [] }];
      
      const result = await (extractor as any).formatData(dataList);
      
      expect(result).toHaveLength(0);
    });

    it('should handle missing note_list gracefully', async () => {
      const dataList = [{}];
      
      const result = await (extractor as any).formatData(dataList);
      
      expect(result).toHaveLength(0);
    });
  });

  describe('getApiEndpoint', () => {
    it('should return correct API endpoint', () => {
      const endpoint = (extractor as any).getApiEndpoint();
      expect(endpoint).toBe('/xhs/note/detail');
    });
  });

  describe('getTypeDisplayName', () => {
    it('should return correct display name', () => {
      const displayName = (extractor as any).getTypeDisplayName();
      expect(displayName).toBe('小红书详情');
    });
  });

  describe('platform and extractType', () => {
    it('should have correct platform and extractType', () => {
      expect((extractor as any).platform).toBe('xhs');
      expect((extractor as any).extractType).toBe('details');
    });
  });
});
