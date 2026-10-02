import { act, fireEvent, render, screen } from "@/tests/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useImageModeSetting } from "@/shared/hooks/useSettings";

import { subscribeImageRecovery } from "@/shared/lib/imageRecovery";
import { LazyImage } from "./LazyImage";

vi.mock("@/shared/hooks/useSettings", () => ({
  useImageModeSetting: vi.fn(() => "off"),
}));

vi.mock("@/shared/lib/imageRecovery", () => ({
  reportBrokenImage: vi.fn(),
  subscribeImageRecovery: vi.fn(),
}));

describe("LazyImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useImageModeSetting).mockReturnValue("off");
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("图片关闭时不订阅恢复，也不创建 IntersectionObserver", () => {
    const observer = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      vi.fn(() => ({
        observe: observer,
        disconnect: vi.fn(),
        unobserve: vi.fn(),
        takeRecords: vi.fn(() => []),
        root: null,
        rootMargin: "",
        thresholds: [],
      })),
    );

    render(
      <LazyImage
        src="https://example.com/image.png"
        threadId="thread-1"
        alt="测试图片"
      />,
    );

    expect(screen.getByText("图片已关闭")).toBeInTheDocument();
    expect(subscribeImageRecovery).not.toHaveBeenCalled();
    expect(IntersectionObserver).not.toHaveBeenCalled();
    expect(observer).not.toHaveBeenCalled();
  });

  function showImages() {
    vi.mocked(useImageModeSetting).mockReturnValue("normal");
    vi.stubGlobal("IntersectionObserver", vi.fn(function (callback: IntersectionObserverCallback) {
      return {
        observe: () => callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver),
        disconnect: vi.fn(),
      };
    }));
  }

  it.each([false, true])("旧解码完成不冒充新图加载，新图自身加载后才显示（旧解码失败=%s）", async (failed) => {
    showImages();
    vi.useFakeTimers();
    const onFallback = vi.fn();
    const props = { alt: "当前图片", fallbackSrc: "/fallback.png", loadTimeoutMs: 4500, onFallback };
    const { rerender } = render(<LazyImage {...props} src={`/decode-old-${failed}.png`} />);
    const oldImage = screen.getByAltText("当前图片") as HTMLImageElement;
    let finish!: () => void;
    oldImage.decode = vi.fn(() => new Promise<void>((resolve, reject) => {
      finish = failed ? () => reject(new Error("解码失败")) : resolve;
    }));
    fireEvent.load(oldImage);
    rerender(<LazyImage {...props} src={`/decode-new-${failed}.png`} />);
    const newImage = screen.getByAltText("当前图片") as HTMLImageElement;
    await act(async () => finish());
    expect(newImage).toHaveClass("opacity-0");
    newImage.decode = vi.fn(async () => {});
    await act(async () => fireEvent.load(newImage));
    expect(newImage).toHaveClass("opacity-100");
    await act(async () => vi.advanceTimersByTimeAsync(4500));
    expect(onFallback).not.toHaveBeenCalled();
  });

  it("旧图解码完成不会关闭挂起新图的超时回退", async () => {
    showImages();
    vi.useFakeTimers();
    const onFallback = vi.fn();
    const props = { alt: "挂起图片", fallbackSrc: "/timeout-fallback.png", loadTimeoutMs: 4500, onFallback };
    const { rerender } = render(<LazyImage {...props} src="/timeout-old.png" />);
    const image = screen.getByAltText("挂起图片") as HTMLImageElement;
    let finish!: () => void;
    image.decode = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    fireEvent.load(image);
    rerender(<LazyImage {...props} src="/timeout-new.png" />);
    await act(async () => finish());
    await act(async () => vi.advanceTimersByTimeAsync(4500));
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(screen.getByAltText("挂起图片")).toHaveAttribute("src", "/timeout-fallback.png");
  });
});
