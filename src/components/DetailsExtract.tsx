import React, { useRef } from 'react';
import * as XLSX from 'xlsx';
import ExtractTypeBase, { ExtractTypeProps } from './ExtractTypeBase';

const DetailsExtract: React.FC<ExtractTypeProps> = (props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          // 处理Excel文件
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });

          // 获取第一个工作表
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          // 转换为JSON数组
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          // 提取所有包含URL的单元格
          const urls: string[] = [];
          jsonData.forEach((row: any) => {
            if (Array.isArray(row)) {
              row.forEach((cell: any) => {
                if (typeof cell === 'string' && (cell.startsWith('http://') || cell.startsWith('https://'))) {
                  urls.push(cell.trim());
                }
              });
            }
          });

          if (urls.length > 0) {
            props.onChange({ ...props.formData, url: urls.join('\n') });
            alert(`成功导入 ${urls.length} 个链接`);
          } else {
            alert('未在Excel文件中找到有效的URL链接');
          }

        } else if (file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
          // 处理文本文件
          const content = e.target?.result as string;
          const urls = content.split('\n')
            .map(line => line.trim())
            .filter(line => line && (line.startsWith('http://') || line.startsWith('https://')));

          if (urls.length > 0) {
            props.onChange({ ...props.formData, url: urls.join('\n') });
            alert(`成功导入 ${urls.length} 个链接`);
          } else {
            alert('未在文件中找到有效的URL链接');
          }
        }
      } catch (error) {
        console.error('文件解析错误:', error);
        alert('文件解析失败，请检查文件格式是否正确');
      }
    };

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }

    // 清空文件输入
    event.target.value = '';
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleDownloadTemplate = () => {
    // 创建CSV模板数据
    const csvContent = [
      '详情链接,备注',
      'https://example.com/post/1,示例文章1',
      'https://example.com/post/2,示例文章2',
      'https://example.com/post/3,示例文章3',
      'https://example.com/article/123,示例详情页1',
      'https://example.com/article/456,示例详情页2'
    ].join('\n');

    // 添加BOM以支持中文显示
    const BOM = '\uFEFF';
    const content = BOM + csvContent;

    // 创建下载链接
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '详情链接模板.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const config = {
    id: 'details',
    title: '详情批量提取',
    description: '提取指定详情页面的数据',
    icon: (
      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    supportPlatforms: ['抖音', '小红书', '快手', 'TikTok', 'YouTube'],
    formList: [
      {
        type: 'textarea' as const,
        name: 'url',
        label: '详情页面链接',
        tooltip: '积分价格前往官网查看',
        placeholder: '请输入详情页面链接，一行一个：\nhttps://example.com/post/1\nhttps://example.com/post/2\nhttps://example.com/post/3',
        rows: 6,
        required: true,
        customActions: [
          {
            label: '模板下载',
            icon: (
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            ),
            onClick: handleDownloadTemplate,
          },
          {
            label: '导入文件',
            icon: (
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            ),
            onClick: handleImportClick,
            variant: 'primary' as const,
          },
        ],
      },
    ],
  };

  return (
    <>
      <ExtractTypeBase {...props} config={config} />
      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.csv,.xlsx,.xls"
        onChange={handleFileImport}
        className="hidden"
      />
    </>
  );
};

export default DetailsExtract;
