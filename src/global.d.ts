declare global {
  namespace Intl {
    interface SegmenterOptions {
      granularity?: 'grapheme' | 'word' | 'sentence';
      localeMatcher?: 'lookup' | 'best fit';
    }
    interface Segment {
      segment: string;
      index: number;
      input: string;
      isWordLike?: boolean;
    }
    interface Segments {
      containing(index: number): Segment;
      [Symbol.iterator](): IterableIterator<Segment>;
    }
    class Segmenter {
      constructor(locales?: string | string[], options?: SegmenterOptions);
      segment(input: string): Segments;
      resolvedOptions(): { locale: string; granularity: string };
    }
  }
}

// CSS Modules 类型声明
declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.module.sass' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.module.less' {
  const classes: { [key: string]: string };
  export default classes;
}

export {};