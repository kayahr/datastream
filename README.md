[GitHub] | [NPM] | [API Doc]

datastream
==========

Data stream classes for reading and writing all kinds of data types. For input and output the data stream classes uses very simple source and sink interfaces which are compatible to the readers and writers provided by [ReadableStream] and [WritableStream] from the [Streams API]. But this library also provides some easy to use stream implementations to use Node.js files and Byte Arrays as source/sink.

The following data types are currently supported:

* Single bits
* Unsigned and signed bytes
* Unsigned and signed 16, 32 and 64 bit values (little and big endian)
* Unsigned and signed byte arrays
* Unsigned and signed 16, 32 and 64 bit arrays (little and big endian)
* Fixed-length strings
* Null-terminated strings
* String lines (LF or CRLF terminated)

See [text-encodings] for a list of supported text encodings.

DataReaderSource
----------------

To read data you first have to create a source. A source is simply an object providing the following method:

```typescript
read(): Promise<ReadableStreamReadResult<Uint8Array>>;
```

You might recognize this signature as it is provided by a reader from a [ReadableStream]. So if you have a standard readable stream from the [Streams API] then you can simply use `stream.getReader()` as a data source (Remember to release the lock on the reader with `reader.releaseLock()` when you no longer need it).

The datastream library also provides a `FileInputStream` implementation for reading from Node.js files and a `Uint8ArraySource` class which can be used to read directly from a static byte array.

DataReader
----------

To read data from a stream create a new DataReader instance and pass the source to it.


```typescript
import { DataReader } from "@kayahr/datastream";

const reader = new DataReader(source);
```

By default the data reader uses the native endianness. You can set a specific endianness as an option:

```typescript
import { Endianness } from "@kayahr/datastream";

const reader = new DataReader(source, { endianness: Endianness.BIG });
```

### Reading single values

Reading single bits, bytes or multi-byte values works like this:

```typescript
const bit = await reader.readBit();
const u8 = await reader.readUint8();
const s8 = await reader.readInt8();
const u16 = await reader.readUint16();
const i16 = await reader.readInt16();
const u32 = await reader.readUint32();
const i32 = await reader.readInt32();
const u64 = await reader.readBigUint64();
const i64 = await reader.readBigInt64();
```

These methods return `null` when the end of the stream is reached. The methods reading multi-byte values also have an endianness parameter which overwrites the endianness of the reader in case you have to read mixed-endianness data. Example:


```typescript
const u32Big = await reader.readUint32(Endianness.BIG);
```

### Reading arrays

Reading arrays from the stream works like this. The following examples only show reading an unsigned byte array but the same methods are available for signed bytes and 16, 32 and 64 bit values:

```typescript
const buffer = new Uint8Array(64);
const bytesRead = await reader.readUint8Array(buffer);
```

The array methods return the number of read values (bytes in this case) which is 0 when end of stream has been reached.

All array methods accept a second option parameter with which you can define the offset within the output buffer, the number of values to read and (for multi-byte values) the endianness.

This example reads 8 signed big endian 32 bit values and writes it at the end (offset 2) of the provided buffer holding 10 values:

```typescript
const buffer = new Int32Array(10);
const valuesRead = await reader.readInt32Array(buffer, {
    offset: 2,
    size: 8,
    endianness: Endianness.BIG
});
```

### Reading strings

A fixed-length string can be read like this:

```typescript
const text = await reader.readString(128);
```

This reads up to 128 bytes from the stream (fewer if end of stream is reached) and converts it to a string. So depending on the text encoding the returned string might be smaller than the given byte size.

An empty string is returned when end of stream has been reached without reading any character.

By default UTF-8 encoding is used. You can specify a different one as second parameter if needed:

```typescript
const text = await reader.readString(128, "shift-jis");
```

To read a null-terminated string instead of a fixed-length string do this:

```typescript
const text = await reader.readNullTerminatedString();
```

To distinguish between end of stream and an empty string (terminated with a null byte) this method returns `null` when end of stream has been reached without reading any character.

The method supports various options:

```typescript
const text = await reader.readNullTerminatedString({
    // Optional encoding, default is UTF-8
    encoding: "shift-jis",
    // Optional initial capacity of byte buffer used for building the string, default is 1024
    initialCapacity: 256,
    // Optional maximum number of bytes to read, default is unlimited
    maxBytes: 1024
);
```

You can also read LF or CRLF terminated lines of strings like this:

```typescript
const line = await reader.readLine();
```

The method returns `null` when end of stream is reached. So wrap it with a while loop if you want to read all lines until the end of stream. `readLine` supports the same options as the `readNullTerminatedString` method (`encoding`, `initialCapacity` and `maxBytes`) with one additional option to include the EOL characters (`\n` or `\r\n`) at the end of the line in the returned string:

```typescript
const lineWithEOL = await reader.readLine({ includeEOL: true });
```

### Working with streams

If you work with a stream as input source then you have to release the lock on the reader acquired from the source in
addition to closing the stream. So you may end up with a nested try..finally structure like this:

```typescript
const stream = new FileInputStream(filename);
try {
    const streamReader = stream.getReader();
    try {
        const dataReader = new DataReader(streamReader);
        // Read stuff from data reader
    } finally {
        streamReader.releaseLock();
    }
} finally {
    await stream.close();
}
```

You can simplify this structure a little bit with the helper function `readDataFromStream` which creates the data
reader and also released the lock on the stream reader. But closing the stream is still your own responsibility:

```typescript
import { readDataFromStream } from "@kayahr/datastream";

const stream = new FileInputStream(filename);
try {
    await readDataFromStream(stream, async reader => {
        // Read stuff from data reader
    });
} finally {
    await stream.close();
}
```

[API Doc]: https://kayahr.github.io/datastream/
[GitHub]: https://github.com/kayahr/datastream
[NPM]: https://www.npmjs.com/package/@kayahr/datastream
[Streams API]: https://developer.mozilla.org/en-US/docs/Web/API/Streams_API
[ReadableStream]: https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream
[WritableStream]: https://developer.mozilla.org/en-US/docs/Web/API/WritableStream
[Encoding API]: https://developer.mozilla.org/en-US/docs/Web/API/Encoding_API
[encodings]: https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder/encoding
[text-encodings]: https://www.npmjs.com/package/@kayahr/text-encoding
