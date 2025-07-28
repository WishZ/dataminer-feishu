/**
 * 将秒数格式化为 xx:xx:xx 格式
 * @param duration 秒数
 * @returns 格式化后的时间字符串
 */
export const formatDuration = (duration: number): string => {
  if (!duration) {
    return "-"
  }
	const hours = Math.floor(duration / 3600);
	const minutes = Math.floor((duration % 3600) / 60);
	const seconds = Math.floor(duration % 60);

	// 如果有小时，则显示 HH:MM:SS 格式
	if (hours > 0) {
		return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
	}
	// 否则只显示 MM:SS 格式
	return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * 将时间戳格式化为 Y-m-d H:i:s 格式
 * @param timestamp 时间戳（秒）
 * @returns 格式化后的日期时间字符串
 */
export const formatTimestamp = (timestamp: number | string | null | undefined): string => {
  if (!timestamp) {
    return "-";
  }
	const date = new Date(Number(timestamp) * 1000);
	
	const year = date.getFullYear();
	const month = (date.getMonth() + 1).toString().padStart(2, '0');
	const day = date.getDate().toString().padStart(2, '0');
	const hours = date.getHours().toString().padStart(2, '0');
	const minutes = date.getMinutes().toString().padStart(2, '0');
	const seconds = date.getSeconds().toString().padStart(2, '0');

	return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};