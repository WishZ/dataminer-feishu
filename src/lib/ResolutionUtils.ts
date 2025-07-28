
export class ResolutionUtils {

  static supportedResolutions = [
    '540p', '720p', '1080p', '2k', '4k'
  ];

  /**
   * 标准化分辨率格式
   * @param resolution 原始分辨率字符串
   * @param defaultResolution 默认分辨率值
   * @returns 标准化后的分辨率字符串
   */
  static normalizeResolution(resolution: any, defaultResolution: string = ''): string {
    // 如果无法转为字符串或传入空值，返回默认值
    try {
      resolution = String(resolution).trim().toLowerCase();
    } catch (error) {
      return defaultResolution;
    }
    
    if (!resolution) {
      return defaultResolution;
    }
    
    if (/^\d+$/.test(resolution)) {
      return resolution + 'p';
    }

    // 处理带描述的格式，如 "HD Quality – 720p" 或 "Full HD Quality – 1080p"
    const specialMatch = this.matchSpecialCharResolution(resolution);
    if (specialMatch) {
      return specialMatch;
    }

    return this.matchHeightResolution(resolution, defaultResolution);
  }

  /**
   * 匹配特殊字符或描述的分辨率
   * @param resolution 分辨率字符串
   * @returns 匹配到的标准分辨率或false
   */
  static matchSpecialCharResolution(resolution: string): string | false {
    // 定义常见缩写和描述映射
    const shorthandMap: Record<string, string> = {
      "sd": "480p",
      "hd": "720p",  // 默认 HD 为 720p，支持常见约定
      "fhd": "1080p",
      "2k": "2k",
      "uhd": "4k",
      "4k": "4k",
      "8k": "8k",
    };
    
    // 检查是否直接匹配缩写或描述
    if (resolution in shorthandMap) {
      return shorthandMap[resolution];
    }

    const containsMap: Record<string, string> = {
      '4k': '4k',
      '2k': '2k',
      'full hd quality': '1080p',
      'full hd': '1080p',
      'fhd': '1080p',
      'hd quality': '720p',
      'hd': '720p',
      'medium quality': '540p',
      'medium': '540p',
      'sd quality': '480p',
      'sd': '480p',
    };
    
    for (const [char, value] of Object.entries(containsMap)) {
      if (resolution.includes(char)) {
        return value;
      }
    }

    return false;
  }

  /**
   * 匹配高度分辨率
   * @param resolution 分辨率字符串
   * @param defaultResolution 默认分辨率值
   * @returns 标准化后的分辨率字符串
   */
  static matchHeightResolution(resolution: string, defaultResolution: string = ''): string {
    // 使用正则表达式匹配分辨率格式（如 1920x1080, 1080p, 720p60, 480*852, 360*640）
    const pattern = /(\d+)[x×*](\d+)|(\d+)(p|i)(\d*)/;
    const match = resolution.match(pattern);

    if (!match) {
      return defaultResolution;
    }

    let height: number;
    
    if (match[1] && match[2]) {  // 匹配 "1920x1080" 或 "480*852" 格式
      const width = parseInt(match[1]);  // 第一个数字为宽度
      height = parseInt(match[2]);  // 第二个数字为高度
      // 选择较小的数字作为高度（适应横屏和竖屏）
      height = Math.min(width, height);
    } else if (match[3] && match[4]) {  // 匹配 "1080p" 或 "720i" 格式
      height = parseInt(match[3]);
    } else {
      return defaultResolution;
    }

    return this.doMatchHeightResolution(height, defaultResolution);
  }

  /**
   * 根据高度值匹配标准分辨率
   * @param height 高度值
   * @param defaultResolution 默认分辨率值
   * @returns 标准化后的分辨率字符串
   */
  static doMatchHeightResolution(height: number, defaultResolution: string = ''): string {
    // 定义标准分辨率及其范围，后缀从2K开始使用"k"，之前用"p"
    const heightMap: [number, string, number, number][] = [
      [120, '120p', 0, 160],  // 超低分辨率
      [144, '144p', 161, 202],  // 低质量流媒体
      [240, '240p', 203, 269],  // 标清早期标准
      [270, '270p', 270, 315],  // 过渡分辨率
      [360, '360p', 316, 400],  // 标清常见分辨率
      [432, '432p', 401, 460],  // 介于360p和480p
      [480, '480p', 461, 510],  // DVD标准
      [540, '540p', 511, 600],  // qHD
      [576, '576p', 601, 630],  // PAL制式标清
      [720, '720p', 631, 900],  // HD标准
      [1080, '1080p', 901, 1200],  // 901-1260
      [1440, '2k', 1200, 1800],  // 1261-1800
      [2160, '4k', 1801, 3240],  // 1801-3240
      [4320, '8k', 3241, 9999],  // 3241+
    ];
    
    // 根据高度找到对应的标准分辨率
    for (const [standardHeight, label, minRange, maxRange] of heightMap) {
      if (minRange <= height && height <= maxRange) {
        return label;
      }
    }

    return defaultResolution;
  }
}