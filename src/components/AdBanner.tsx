import React from 'react';

const AdBanner: React.FC = () => {
  const handleClick = () => {
    window.open('https://data.snappdown.com/', '_blank');
  };

  return (
    <div
      className="mb-6 cursor-pointer transition-all duration-300 hover:-translate-y-0.5"
      onClick={handleClick}
    >
      <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-xl p-4 text-white shadow-lg hover:shadow-xl transition-shadow duration-300 relative overflow-hidden">
        {/* 背景装饰 */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
        <div className="absolute -top-2 -right-2 w-16 h-16 bg-white/5 rounded-full blur-lg"></div>
        <div className="absolute -bottom-1 -left-1 w-12 h-12 bg-white/5 rounded-full blur-md"></div>

        <div className="relative z-10">
          {/* 主标题和按钮 */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center mr-3 backdrop-blur-sm">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div>
                <div className="text-base font-bold">获取 API KEY</div>
                <div className="text-xs opacity-80">专业数据提取服务</div>
              </div>
            </div>

            <div className="bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg font-semibold text-sm hover:bg-white/30 transition-colors duration-200 flex items-center">
              立即获取
              <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>

          {/* 描述文字 */}
          <div className="text-sm opacity-90 mb-3 leading-relaxed">
            访问 <span className="font-semibold text-yellow-200">data.snappdown.com</span> 获取您的专属密钥
          </div>

          {/* 特性标签 */}
          <div className="flex flex-wrap gap-1.5">
            <span className="bg-white/15 px-2 py-0.5 rounded-md text-xs font-medium flex items-center">
              <span className="w-1 h-1 bg-green-300 rounded-full mr-1.5"></span>
              批量提取
            </span>
            <span className="bg-white/15 px-2 py-0.5 rounded-md text-xs font-medium flex items-center">
              <span className="w-1 h-1 bg-blue-300 rounded-full mr-1.5"></span>
              实时支持
            </span>
            <span className="bg-white/15 px-2 py-0.5 rounded-md text-xs font-medium flex items-center">
              <span className="w-1 h-1 bg-purple-300 rounded-full mr-1.5"></span>
              专业服务
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdBanner;
