import './App.css';
import { useState, useEffect } from 'react';
import AdBanner from './components/AdBanner';
import ExtractTypeSelector, { ExtractType } from './components/ExtractTypeSelector';
import HomepageExtract from './components/HomepageExtract';
import CommentsExtract from './components/CommentsExtract';
import DetailsExtract from './components/DetailsExtract';
import { ExtractFormData } from './components/ExtractTypeBase';
import { DataExtractionService, ExtractionRequest } from './services/DataExtractionService';
import { ITableMeta } from "@lark-base-open/js-sdk";

interface FormData {
  apiKey: string;
  extractType: ExtractType;
  extractData: ExtractFormData;
}

export default function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [showApiKey, setShowApiKey] = useState(false);
  const [availableTables, setAvailableTables] = useState<ITableMeta[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [createNewTable, setCreateNewTable] = useState(true);
  const [extractionService, setExtractionService] = useState<DataExtractionService | null>(null);

  const [formData, setFormData] = useState<FormData>({
    apiKey: '',
    extractType: 'homepage',
    extractData: {
      url: '',
      range: 5,
      range_type: 5,
      startDate: undefined,
    },
  });

  // 初始化数据提取服务
  useEffect(() => {
    const initService = async () => {
      try {
        const service = new DataExtractionService((progress, message) => {
          setProgress(progress);
          setStatus(message);
        });

        await service.initialize();
        setExtractionService(service);

        // 获取可用表格列表
        const tables = await service.getAvailableTables();
        setAvailableTables(tables);

        // 获取当前选中的表格
        const selection = await service.getCurrentSelection();
        if (selection.tableId) {
          setSelectedTableId(selection.tableId);
          // 保持默认选择"创建新表格"，不自动切换到现有表格
          // setCreateNewTable(false);
        }
      } catch (error) {
        console.error('Failed to initialize extraction service:', error);
        setStatus('初始化服务失败，请刷新页面重试');
      }
    };

    initService();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!extractionService) {
      setStatus('服务未初始化，请刷新页面重试');
      return;
    }

    setIsLoading(true);
    setProgress(0);
    setStatus('开始数据提取...');

    try {
      // 构建提取请求
      const request: ExtractionRequest = {
        apiKey: formData.apiKey,
        extractType: formData.extractType,
        url: formData.extractData.url,
        range: formData.extractData.range,
        range_type: formData.extractData.range_type,
        startDate: formData.extractData.startDate,
        includeReplies: formData.extractData.includeReplies, // 传递 includeReplies 选项
        tableOptions: {
          tableId: createNewTable ? undefined : selectedTableId,
          createNewTable,
          tableName: createNewTable ? undefined : undefined,
        },
      };

      // 执行数据提取和表格更新
      const result = await extractionService.extractAndUpdate(request);

      if (result.success) {
        setStatus(`✅ ${result.message}`);

        // 如果创建了新表格，更新表格列表
        if (result.tableResult?.tableId) {
          const tables = await extractionService.getAvailableTables();
          setAvailableTables(tables);
          setSelectedTableId(result.tableResult.tableId);
        }
      } else {
        setStatus(`❌ ${result.message}`);
        console.error('提取失败:', result);
      }

    } catch (error) {
      console.error('提取过程出错:', error);
      setStatus(`❌ 提取过程出错: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
      setProgress(100);
    }
  };

  const handleExtractTypeChange = (extractType: ExtractType) => {
    // 根据不同的提取类型设置不同的初始值
    let initialData: any = {
      url: '',
      startDate: undefined,
    };

    // 只有homepage类型才有range相关字段
    if (extractType === 'homepage') {
      initialData = {
        ...initialData,
        range: 5,
        range_type: 5,
      };
    } else {
      initialData = {
        ...initialData,
        range: 1,
      };
    }

    setFormData(prev => ({
      ...prev,
      extractType,
      extractData: initialData
    }));
  };

  const handleExtractDataChange = (extractData: ExtractFormData) => {
    setFormData(prev => ({
      ...prev,
      extractData
    }));
  };

  const handleApiKeyChange = (apiKey: string) => {
    setFormData(prev => ({
      ...prev,
      apiKey
    }));
  };

  const handleApiKeyFocus = () => {
    setShowApiKey(true);
  };

  const handleApiKeyBlur = () => {
    // 失去焦点时，如果长度大于6则隐藏
    if (formData.apiKey.length > 6) {
      setShowApiKey(false);
    }
  };

  // 格式化API KEY显示
  const formatApiKeyDisplay = (apiKey: string) => {
    if (!apiKey || apiKey.length <= 6) {
      return apiKey;
    }
    const start = apiKey.substring(0, 3);
    const end = apiKey.substring(apiKey.length - 3);
    const middle = '*'.repeat(Math.max(6, apiKey.length - 6));
    return `${start}${middle}${end}`;
  };

  // 获取显示的API KEY值
  const getDisplayValue = () => {
    if (showApiKey || formData.apiKey.length <= 6) {
      return formData.apiKey;
    }
    return formatApiKeyDisplay(formData.apiKey);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-md mx-auto">
        {/* 广告横幅 */}
        <AdBanner />

        {/* 主表单卡片 */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200/60 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* API Key 输入框 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-700">
                  API KEY <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => window.open('https://data.snappdown.com/', '_blank')}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center"
                >
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1721 9z" />
                  </svg>
                  API KEY获取
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={showApiKey ? formData.apiKey : getDisplayValue()}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  onFocus={handleApiKeyFocus}
                  onBlur={handleApiKeyBlur}
                  placeholder="请输入您的 API KEY"
                  className="w-full px-4 py-3 pl-11 pr-11 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  required
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                {formData.apiKey.length > 6 && (
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    title={showApiKey ? "隐藏 API KEY" : "显示 API KEY"}
                  >
                    {showApiKey ? (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* 提取类型选择器 */}
            <ExtractTypeSelector
              value={formData.extractType}
              onChange={handleExtractTypeChange}
            />

            {/* 动态表单组件 */}
            <HomepageExtract
              formData={formData.extractData}
              onChange={handleExtractDataChange}
              isActive={formData.extractType === 'homepage'}
            />

            <CommentsExtract
              formData={formData.extractData}
              onChange={handleExtractDataChange}
              isActive={formData.extractType === 'comments'}
            />

            <DetailsExtract
              formData={formData.extractData}
              onChange={handleExtractDataChange}
              isActive={formData.extractType === 'details'}
            />

            {/* 表格选择 */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700">
                数据存储选项
              </label>

              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={createNewTable}
                    onChange={() => setCreateNewTable(true)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">创建新表格</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={!createNewTable}
                    onChange={() => setCreateNewTable(false)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">使用现有表格</span>
                </label>
              </div>

              {!createNewTable && (
                <select
                  value={selectedTableId}
                  onChange={(e) => setSelectedTableId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                >
                  <option value="">请选择表格</option>
                  {availableTables.map((table) => (
                    <option key={table.id} value={table.id}>
                      {table.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* 状态显示 */}
            {status && (
              <div className={`p-4 rounded-xl text-sm font-medium ${
                status.includes('❌') || status.includes('失败')
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : status.includes('✅') || status.includes('完成')
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span>{status}</span>
                  {isLoading && (
                    <span className="text-xs">{progress}%</span>
                  )}
                </div>

                {/* 进度条 */}
                {isLoading && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                )}
              </div>
            )}

            {/* 提交按钮 */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-200 ${
                isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 hover:shadow-lg hover:-translate-y-0.5'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="loading-spinner"></div>
                  正在提取数据...
                </div>
              ) : (
                '开始提取数据'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}