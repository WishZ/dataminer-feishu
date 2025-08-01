/**
 * 代理工具类
 * 用于生成媒体文件的代理URL，解决跨域和防盗链问题
 */
export class ProxyUtils {
  // 密钥
  private static SECRET_KEY = "6m9VM01vDwl9yz7L";

  /**
   * 生成签名
   * @param url 原始URL
   * @param expire 过期时间戳
   * @returns 签名字符串
   */
  static async generateSignature(url: string, expire: number): Promise<string> {
    const message = `${url}&&${expire}`;
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(this.SECRET_KEY),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(message)
    );

    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    return encodeURIComponent(
      signatureArray.map((b) => b.toString(16).padStart(2, "0")).join("")
    );
  }

  /**
   * 构建代理URL
   * @param url 原始媒体URL
   * @param expireAdd 过期时间增量（秒），默认1小时
   * @param platform 平台标识
   * @param ck Cookie信息
   * @param parseUrl 解析URL
   * @returns 代理URL
   */
  static async buildProxyUrl(
    url: string,
    expireAdd: number = 60 * 60,
    platform: string = "",
    ck: string = "",
    parseUrl: string = ""
  ): Promise<string> {
    const expire = Math.floor(Date.now() / 1000) + expireAdd;
    const signature = await this.generateSignature(url, expire);

    const baseUrl = "/api/proxy/media?";
    const params = new URLSearchParams();

    params.append("url", url);
    params.append("signature", signature);
    params.append("expire", expire.toString());

    if (platform) {
      params.append("platform", platform);
    }
    if (ck) {
      params.append("ck", ck);
    }
    if (parseUrl) {
      params.append("parse_url", parseUrl);
    }

    return baseUrl + params.toString();
  }

  static async buildDownloadProxyUrl(
    url: string,
    expireAdd: number = 60 * 60,
    platform: string = "",
    ck: string = "",
    filename: string = ""
  ): Promise<string> {
    const expire = Math.floor(Date.now() / 1000) + expireAdd;
    const signature = await this.generateSignature(url, expire);

    const baseUrl = "/api/download/proxy?";
    const params = new URLSearchParams();
    params.append("url", url);
    params.append("signature", signature);
    params.append("expire", expire.toString());
    if (platform) {
      params.append("platform", platform);
    }
    if (ck) {
      params.append("ck", ck);
    }
    if (filename) {
      params.append("filename", filename);
    }

    return baseUrl + params.toString();
  }

  /**
   * 批量构建代理URL
   * @param urls 原始URL数组
   * @param expireAdd 过期时间增量（秒）
   * @param platform 平台标识
   * @param ck Cookie信息
   * @returns 代理URL数组
   */
  static async buildProxyUrls(
    urls: string[],
    expireAdd: number = 60 * 60,
    platform: string = "",
    ck: string = ""
  ): Promise<string[]> {
    const proxyUrls: string[] = [];

    for (const url of urls) {
      if (url && url.trim()) {
        try {
          const proxyUrl = await this.buildProxyUrl(
            url,
            expireAdd,
            platform,
            ck
          );
          proxyUrls.push(proxyUrl);
        } catch (error) {
          console.error(`生成代理URL失败: ${url}`, error);
          proxyUrls.push(url); // 失败时返回原始URL
        }
      } else {
        proxyUrls.push("");
      }
    }

    return proxyUrls;
  }

  /**
   * 检查URL是否需要代理
   * @param url 原始URL
   * @returns 是否需要代理
   */
  static needsProxy(url: string): boolean {
    if (!url || !url.trim()) {
      return false;
    }

    // 检查是否已经是代理URL
    if (url.includes("/api/proxy/media") || url.includes("snappdown.com/api/proxy/media")) {
      return false;
    }

    // 检查是否是需要代理的域名
    const needsProxyDomains = [
      "tiktok.com",
      "tiktokcdn.com",
      "douyin.com",
      "douyinpic.com",
      "douyinvod.com",
      "xiaohongshu.com",
      "xhscdn.com",
      "youtube.com",
      "googlevideo.com",
    ];

    return needsProxyDomains.some((domain) => url.includes(domain));
  }

  /**
   * 智能处理URL - 需要代理的生成代理URL，不需要的返回原URL
   * @param url 原始URL
   * @param platform 平台标识
   * @param expireAdd 过期时间增量（秒）
   * @returns 处理后的URL
   */
  static async smartProxyUrl(
    url: string,
    platform: string = "",
    expireAdd: number = 60 * 60
  ): Promise<string> {
    if (!this.needsProxy(url)) {
      return url;
    }

    try {
      return await this.buildProxyUrl(url, expireAdd, platform);
    } catch (error) {
      console.error(`智能代理URL生成失败: ${url}`, error);
      return url; // 失败时返回原始URL
    }
  }
}
