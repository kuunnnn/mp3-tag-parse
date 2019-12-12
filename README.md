## ID3V1
* 读(文本按照 utf8编码进行读取)
* 写(以 utf8 编码写入)
* 对于文本需要其是正确的 utf8编码或 utf8完全兼容的,不然可能出现乱码,及报错(不是正确的 utf8)

## ID3V2
### [id3v2.3](http://id3.org/id3v2.3.0)
* 暂时只支持 读
* 只支持 2.3 不支持 2.4 版本
* 不支持同步flag
* 会跳过扩展头
* 不会处理帧的 flag(直接无视, 如果标记为压缩,加密,则跳过)
* 不会处理 TXXX
* 只处理 /^T/(除了 TXXX 以外的所有)  APIC(图片) COMM(注释) USLT(非同步歌词) SYLT(同步歌词todo))
* 对于文本需要其是正确的 [utf8,utf16le ,utf16be, ISO-8859-1],不然可能出现乱码,及报错(错误的编码)

## APEv2
**优点**
* 格式简单
* 编码简单 utf8 和 binary

**位置** 
可能放置在 data 前id3v2 后也可能在 data 后 id3v1 前, 以8 字节 "APETAGEX" 表示

**注意事项**
* header 和 footer 只有一位不同(flags 的第 29 位),并且 header 和 footer 可能不会同时存在
* size 和 flags 都是高位在后如 size: `Value = (byte[3] << 24) + (byte[2] << 16) + (byte[1] << 8) + byte[0]`
* item 的 value 在 apev2 中有三种情况 0 utf8 文字 1 二进制数据 3 utf8的链接 如:`ftp:// file://` 

> [apev2-key] (http://wiki.hydrogenaud.io/index.php?title=APE_key)
> [apev2-value] (http://wiki.hydrogenaud.io/index.php?title=APE_Item_Value)



