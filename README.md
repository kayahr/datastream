Datastream
==========

[GitHub] | [NPM] | [API Doc]

Data stream classes for reading and writing all kinds of data types. For input and output the data stream classes uses very simple source and sink interfaces which are compatible to the readers and writers provided by [ReadableStream] and [WritableStream] from the [Streams API]. But this library also provides some easy to use stream implementations to use Node.js files and Byte Arrays as source/sink.

The following data types are currently supported:

* Single bits
* Arrays of bits
* Unsigned and signed bytes
* Unsigned and signed 16, 32 and 64 bit values (little and big endian)
* Unsigned and signed byte arrays
* Unsigned and signed 16, 32 and 64 bit arrays (little and big endian)
* Fixed-length strings
* Null-terminated strings
* String lines (LF or CRLF terminated)

See [text-encodings] for a list of supported text encodings.

Usage
-----

Install the library as a dependency in your project:

```
npm install @kayahr/datastream
```

And then use it like in this example:

```typescript
import { DataReader, DataWriter, Uint8ArraySource, Uint8ArraySink } from "@kayahr/datastream";

const sink = new Uint8ArraySink();
const writer = new DataWriter(sink);
await writer.writeBit(1);
await writer.writeBit(2);
await writer.writeUint16(0x1234);
await writer.flush();
const data = sink.getData();

const source = new Uint8ArraySource(data);
const reader = new DataReader(source);
const bit1 = await reader.readBit();
const bit2 = await reader.readBit();
const u16 = await reader.readUint16();
```

Instead of simply using a Uint8Array as sink and source you can also read from streams and write to streams which is explained in the next sections.

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

By default the data reader uses the native endianness for reading multi-byte values and utf-8 encoding for reading strings. You can set a specific endianness and/or encoding as options:

```typescript
import { Endianness } from "@kayahr/datastream";

const reader = new DataReader(source, {
    endianness: Endianness.BIG,
    encoding: "utf-16be"
});
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


### Reading bit arrays

Reading a list of bits is a little bit different then the other array read methods. Instead of passing an array to fill you only specify the number of bits you want to read and you get a number array where each entry represents a single bit. When end-of-stream has been reached without reading any bits then the returned array is empty.

```typescript
const bits = await this.readBits(10);
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

### Reading from streams

If you work with a readable stream as input source then you have to release the lock on the stream reader acquired from the stream in addition to closing the stream. So you may end up with a nested try..finally structure like this:

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
reader and also releases the lock on the stream reader. But closing the stream is still your own responsibility:

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

### Skipping data

Instead of reading data you can also simply skip data. This is faster than reading/ignoring data because it fast-forwards through the current and subsequently read buffers without actually looking at the data.

```typescript
const skippedBits = await reader.skipBits(30);
await fullySkippedBytes = await reader.skipBytes(5);
```

`skipBits` returns the number of actually skipped bits which may be lower than the requested number of bits when end-of-stream has been reached.

`skipBytes` returns the number of full bytes that have been skipped (not counting partially read bytes). Again this can be lower than the requested number of bytes when end-of-stream has been reached.

### Look-ahead

`DataReader` supports look-ahead operations which remembers the current stream position and restores it after the read-ahead operation is finished.

Some examples:

```typescript
const nextLine = await reader.lookAhead(() => reader.readLine());
```

```typescript
const { foo, bar } = await reader.lookAhead(async () => {
    const foo = await reader.readBit();
    const bar = await reader.readUint8();
    return { foo, bar };
});
```

You can perform any read operation and as many as you like inside the function passed to the `lookAhead` method. You can even nest a look-ahead inside the look-ahead. But keep in mind that reading large amount of data in a look-ahead results in buffers piling up in memory because they need to be recorded to be able to restore the previous stream position because it is not possible to seek in a stream. So keep your look-ahead operations short so ideally they are performed within the same buffer or simply the next one.

A look-ahead function can also decide to commit a specific amount of bytes or bits as finally read. This is useful for example if you read ahead lets say 20 bytes to scan the content, then you see that it begins with 3 bytes you are looking for so you commit these 3 bytes so the stream pointer only rewinds by 17 bytes:

```typescript
const foo = await reader.lookAhead(async commit => {
    const string = await.readString(20);
    if (string.startsWith("foo")) {
        commit(3);
        return "foo";
    } else {
        return null;
    }
});
```

When you call `commit()` without parameters then all data read in the look-ahead operation is committed. If you want to commit a number of bits instead of bytes then pass `1` as second parameter. This second parameter defines the bits per value which defaults to 8. So `commit(12)` is the same as `commit(12, 8)` which commits twelve 8-bit values. `commit(12, 1)` commits twelve 1-bit values (12 bits).

DataWriterSink
--------------

To write data you first have to create a sink. A sink is simply an object providing the following method:

```typescript
write(chunk: Uint8Array): Promise<void>;
```

You might recognize this signature as it is provided by a writer from a [WritableStream]. So if you have a standard writable stream from the [Streams API] then you can simply use `stream.getWriter()` as a data sink (Remember to release the lock on the writer with `writer.releaseLock()` when you no longer need it).

The datastream library also provides a `FileOutputStream` implementation for writing to Node.js files and a `Uint8ArraySink` class which can be used to write directly to a growing byte array.

DataWriter
----------

To write data to a stream create a new DataWriter instance and pass the sink to it.

```typescript
import { DataWriter } from "@kayahr/datastream";

const writer = new DataWriter(sink);
```

By default the data writer uses the native endianness for writing multi-byte values, UTF-8 encoding for writing strings and a buffer size of 64 KiB. You can set specific settings through options:

```typescript
import { Endianness } from "@kayahr/datastream";

const writer = new DataWriter(sink, {
    endianness: Endianness.BIG,
    encoding: "utf-16be",
    bufferSize: 8192
});
```

### Writing values

Writing single bits, bytes, multi-byte values, arrays and strings works like this:

```typescript
writer.writeBit(1);
writer.writeUint8(5);
writer.writeInt8(-3);
writer.writeUint16(10000);
writer.writeInt16(-5000);
writer.writeUint32(5762874);
writer.writeInt32(-2357622);
writer.writeBigUint64(75721771n);
writer.writeBigInt64(-3247534n);
writer.writeUint8Array(new Uint8Array(values));
writer.writeUint8Array(new Int8Array(values));
writer.writeUint16Array(new Uint16Array(values));
writer.writeUInt16Array(new Int16Array(values));
writer.writeUint32Array(new Uint32Array(values));
writer.writeUInt32Array(new Int32Array(values));
writer.writeBigUint64Array(new BigUint64Array(values));
writer.writeBigInt64Array(new BigInt64Array(values));
writer.writeString("Foo");
```

All write methods synchronously fills the write buffer and flushes the buffer asynchronously when full.

In case you are finished writing to the writer you have to flush the buffer a last time and await the returned promise to ensure it is fully written to the sink:

```typescript
await writer.flush();
```

When writing multi-bytes you can specify the endianness. If you don't do this then the global endianness of the writer is used which defaults to the native endianness. Example for specifying endianness:

```typescript
writer.writeUint32(123456, Endianness.BIG)
```

When writing strings then you can specify the text encoding. If you don't do this then the global encoding of the writer is used which defaults to UTF-8. Example for specifying encoding:

```typescript
writer.writeString("灯台もと暗し。", "Shift-JIS")
```

If you want to write null-terminated strings or lines then append `"\0"` or EOF characters like `"\r\n"` yourself.

### Text-Encodings

This project depends on the [text-encodings] project to support a lot of text encodings. But by default no encoding is loaded so only the default UTF-8 encoding is available. If you want to write strings in other encodings then you have to import the specific encodings or all encodings yourself:

```typescript
import "@kayahr/text-encoding/encodings/shift_jis"; // Imports a specific text encoding
import "@kayahr/text-encoding/encodings";           // Imports all text encodings
```

### Writing to streams

If you work with a writable stream as output sink then you have to release the lock on the stream writer acquired from the stream in addition to closing the stream. So you may end up with a nested try..finally structure like this:

```typescript
const stream = new FileOutputStream(filename);
try {
    const streamWriter = stream.getWriter();
    try {
        const dataWriter = new DataWriter(streamWriter);
        // Write stuff to data writer
        await dataWriter.flush();
    } finally {
        streamWriter.releaseLock();
    }
} finally {
    await stream.close();
}
```

You can simplify this structure a little bit with the helper function `writeDataToStream` which creates the data
writer and also releases the lock on the stream writer. But closing the stream is still your own responsibility:

```typescript
import { writeDataToStream } from "@kayahr/datastream";

const stream = new FileOutputStream(filename);
try {
    await writeDataToStream(stream, async writer => {
        // Read stuff from data reader
        await writer.flush();
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
