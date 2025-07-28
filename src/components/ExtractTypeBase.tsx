import React from 'react';

export interface ExtractFormData {
  [key: string]: any;
}

export interface ExtractTypeProps {
  formData: ExtractFormData;
  onChange: (data: ExtractFormData) => void;
  isActive: boolean;
}

export interface FormField {
  type: 'url' | 'number' | 'date' | 'textarea' | 'quickButtons' | 'checkbox';
  name: string;
  label: string;
  tooltip?: string;
  placeholder?: string;
  suffix?: string;
  max?: number;
  min?: number;
  required?: boolean;
  options?: Array<{ label: string; value: number | 'all' | string }>;
  rows?: number;
  customActions?: Array<{
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    variant?: 'default' | 'primary';
  }>;
  showWhen?: (formData: ExtractFormData) => boolean;
  targetField?: string; // quickButtons类型用于指定要设置的目标字段
  defaultValue?: any; // checkbox类型的默认值
}

export interface ExtractTypeConfig {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  supportPlatforms: string[];
  formList: FormField[];
}

const ExtractTypeBase: React.FC<ExtractTypeProps & { config: ExtractTypeConfig }> = ({
  formData,
  onChange,
  isActive,
  config
}) => {
  const handleFieldChange = (fieldName: string, value: any) => {
    onChange({ ...formData, [fieldName]: value });
  };

  // 获取今天的日期字符串 (YYYY-MM-DD)
  const getTodayString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // 获取快捷日期选择
  const getQuickDate = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  };

  if (!isActive) return null;

  const renderField = (field: FormField) => {
    const fieldValue = formData[field.name];

    switch (field.type) {
      case 'url':
        return (
          <div key={`${field.name}-url`}>
            <div className="flex items-center mb-2">
              <label className="text-sm font-semibold text-gray-700">
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </label>
              {field.tooltip && (
                <div className="relative ml-1 group">
                  <svg
                    className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20">
                    {field.tooltip}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              )}
            </div>
            <div className="relative">
              <input
                type="url"
                value={fieldValue || ''}
                onChange={(e) => handleFieldChange(field.name, e.target.value)}
                placeholder={field.placeholder}
                className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                required={field.required}
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                {config.icon}
              </div>
            </div>
          </div>
        );

      case 'quickButtons':
        return (
          <div key={`${field.name}-quickButtons`}>
            {field.label && (
              <div className="flex items-center mb-2">
                <label className="text-sm font-semibold text-gray-700">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                {field.tooltip && (
                  <div className="ml-2 group relative">
                    <svg className="w-4 h-4 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      {field.tooltip}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2 mb-3">
              {field.options?.map((option) => {
                // 判断是否选中
                const isSelected = fieldValue === option.value;

                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => {
                      // 同时设置range_type和range的值
                      let updates: any = {
                        [field.name]: option.value
                      };

                      // 如果有targetField，同时设置目标字段的值
                      if (field.targetField) {
                        let targetValue;
                        if (option.value === 'all') {
                          targetValue = 'all';
                        } else if (option.value === 'custom') {
                          // 自定义时不设置range值，等用户输入
                          targetValue = undefined;
                        } else {
                          targetValue = option.value;
                        }
                        updates[field.targetField] = targetValue;
                      }

                      // 一次性更新所有字段
                      onChange({ ...formData, ...updates });
                    }}
                    className={`flex-1 px-3 py-2 text-xs font-medium border rounded-lg transition-colors ${
                      isSelected
                        ? 'bg-indigo-500 text-white border-indigo-500'
                        : 'text-gray-600 bg-gray-50 border-gray-200 hover:bg-gray-100 hover:text-gray-700'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 'number':
        // 检查是否是条件显示的字段，如果是自定义模式则需要必填
        const isCustomMode = field.showWhen && field.showWhen(formData);
        const isRequired = field.required || (isCustomMode && formData.range_type === 'custom');

        return (
          <div key={`${field.name}-number`}>
            {field.label && (
              <div className="flex items-center mb-2">
                <label className="text-sm font-semibold text-gray-700">
                  {field.label} {isRequired && <span className="text-red-500">*</span>}
                </label>
                {field.tooltip && (
                  <div className="relative ml-1 group">
                    <svg
                      className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help transition-colors"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20">
                      {field.tooltip}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="relative">
              <input
                type="number"
                min={field.min}
                max={field.max}
                value={fieldValue || ''}
                onChange={(e) => handleFieldChange(field.name, parseInt(e.target.value) || field.min || 1)}
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                required={isRequired}
                placeholder={isCustomMode ? "请输入自定义页数" : field.placeholder}
              />
              {field.suffix && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="text-sm text-gray-500">{field.suffix}</span>
                </div>
              )}
            </div>
            {field.min && field.max && (
              <p className="text-xs text-gray-500 mt-1">
                建议范围：{field.min}-{field.max}{field.suffix}
              </p>
            )}
          </div>
        );

      case 'date':
        return (
          <div key={`${field.name}-date`}>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {field.label} {field.required && <span className="text-red-500">*</span>}
              {!field.required && <span className="text-xs text-gray-500 font-normal">(可选)</span>}
            </label>

            {/* 快捷日期选择 */}
            {field.options && (
              <div className="flex gap-2 mb-3">
                {field.options.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => handleFieldChange(field.name, getQuickDate(Number(option.value)))}
                    className="flex-1 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 hover:text-gray-700 transition-colors"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}

            {/* 自定义日期 */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">自定义开始日期</label>
              <div className="relative group">
                <input
                  type="date"
                  value={fieldValue || ''}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  max={getTodayString()}
                  className="w-full text-sm border border-gray-300 focus:border-indigo-500 focus:ring-indigo-500/20 transition-all duration-200 pl-10 pr-10 py-2.5 rounded-lg bg-white hover:bg-gray-50 focus:bg-white cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  style={{ colorScheme: 'light' }}
                  required={field.required}
                />
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-indigo-500 transition-colors duration-200 pointer-events-none">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                {fieldValue && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFieldChange(field.name, undefined);
                    }}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors duration-200 z-10"
                    title="清除日期"
                  >
                    <div className="w-4 h-4 rounded-full bg-gray-200 hover:bg-red-100 flex items-center justify-center">
                      <span className="text-xs">×</span>
                    </div>
                  </button>
                )}
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-2">
              可选择时间范围进一步筛选数据，不选择则按页数获取最新数据
            </p>
          </div>
        );

      case 'textarea':
        return (
          <div key={`${field.name}-textarea`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <label className="text-sm font-semibold text-gray-700">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                {field.tooltip && (
                  <div className="relative ml-1 group">
                    <svg
                      className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help transition-colors"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20">
                      {field.tooltip}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                )}
              </div>
              {field.customActions && (
                <div className="flex items-center space-x-3">
                  {field.customActions.map((action, index) => {
                    const isPrimary = action.variant === 'primary';
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={action.onClick}
                        className={`text-xs font-medium flex items-center transition-colors ${
                          isPrimary
                            ? 'text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded-md'
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                      >
                        {action.icon}
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <textarea
              value={fieldValue || ''}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none"
              rows={field.rows || 6}
              required={field.required}
            />

            {field.name === 'url' && fieldValue && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-gray-500">
                  支持多个链接，一行一个。已输入 <span className="font-medium text-indigo-600">{fieldValue.split('\n').filter((line: string) => line.trim()).length}</span> 个链接
                </p>
                <p className="text-xs text-gray-500">
                  支持导入 .txt, .csv, .xlsx, .xls 文件
                </p>
              </div>
            )}
          </div>
        );

      case 'checkbox':
        return (
          <div key={`${field.name}-checkbox`}>
            <div className="flex items-center space-x-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id={field.name}
                  checked={fieldValue !== undefined ? fieldValue : (field.defaultValue || false)}
                  onChange={(e) => handleFieldChange(field.name, e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded transition-colors"
                />
              </div>
              <div className="flex items-center">
                <label htmlFor={field.name} className="text-sm font-medium text-gray-700 cursor-pointer">
                  {field.label}
                </label>
                {field.tooltip && (
                  <div className="ml-2 group relative">
                    <svg className="w-4 h-4 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      {field.tooltip}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 mt-4">
      {config.formList.map((field) => {
        // 如果是快捷按钮，查找对应的数字字段并在其前面渲染
        if (field.type === 'quickButtons') {
          return null; // 快捷按钮会在对应的数字字段中渲染
        }

        // 查找是否有对应的快捷按钮
        const quickButtonField = config.formList.find(f =>
          f.type === 'quickButtons' && f.targetField === field.name
        );

        // 检查是否应该显示该字段
        const shouldShow = !field.showWhen || field.showWhen(formData);

        if (!shouldShow) {
          return quickButtonField ? (
            <div key={`${field.name}-quickButtons-only`}>
              {renderField(quickButtonField)}
            </div>
          ) : null;
        }

        return (
          <div key={`${field.name}-field-group`}>
            {quickButtonField && renderField(quickButtonField)}
            {renderField(field)}
          </div>
        );
      })}
    </div>
  );
};

export default ExtractTypeBase;
