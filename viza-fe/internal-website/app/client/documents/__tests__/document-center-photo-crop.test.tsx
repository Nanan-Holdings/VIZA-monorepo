import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DocumentApplication,
  DocumentCenterData,
  DocumentRequirement,
} from "../actions";

interface PhotoCropToolProps {
  imageObjectUrl: string;
  onCropComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

const mocks = vi.hoisted(() => ({
  uploadApplicationDocumentFromClient: vi.fn(),
  loadDocumentCenterData: vi.fn(),
  removeApplicationDocument: vi.fn(),
  reuseUniversalProfileDocument: vi.fn(),
  cropToolProps: null as PhotoCropToolProps | null,
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
}));

vi.mock("@/lib/document-upload-client", () => ({
  uploadApplicationDocumentFromClient: mocks.uploadApplicationDocumentFromClient,
}));

vi.mock("../actions", () => ({
  loadDocumentCenterData: mocks.loadDocumentCenterData,
  removeApplicationDocument: mocks.removeApplicationDocument,
  reuseUniversalProfileDocument: mocks.reuseUniversalProfileDocument,
}));

vi.mock("@/components/application-steps/photo-crop-tool", () => ({
  PhotoCropTool: (props: PhotoCropToolProps) => {
    mocks.cropToolProps = props;
    return (
      <div data-testid="photo-crop-tool">
        <button type="button" onClick={props.onCancel}>
          Cancel crop
        </button>
      </div>
    );
  },
}));

import { DocumentCenterClient } from "../document-center-client";

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  copy.set(bytes);
  return copy.buffer;
}

function buildJpegBytes(width: number, height: number): Uint8Array {
  const sofPayload = [
    8,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    3,
    1,
    0x11,
    0,
    2,
    0x11,
    0,
    3,
    0x11,
    0,
  ];
  const sosPayload = [3, 1, 0, 2, 0, 3, 0, 0, 0x3f, 0];
  const result = [
    0xff,
    0xd8,
    0xff,
    0xc0,
    0,
    sofPayload.length + 2,
    ...sofPayload,
    0xff,
    0xda,
    0,
    sosPayload.length + 2,
    ...sosPayload,
    0,
    0xff,
    0,
    1,
    0xff,
    0xd9,
  ];
  const bytes = new Uint8Array(new ArrayBuffer(result.length));
  bytes.set(result);
  return bytes;
}

function photoFile(bytes: Uint8Array, name = "photo.jpg"): File {
  const file = new File([toArrayBuffer(bytes)], name, { type: "image/jpeg" });
  Object.defineProperty(file, "arrayBuffer", {
    configurable: true,
    value: async () => toArrayBuffer(bytes),
  });
  return file;
}

function photoBlob(bytes: Uint8Array): Blob {
  const blob = new Blob([toArrayBuffer(bytes)], { type: "image/jpeg" });
  Object.defineProperty(blob, "arrayBuffer", {
    configurable: true,
    value: async () => toArrayBuffer(bytes),
  });
  return blob;
}

function application(id: string): DocumentApplication {
  return {
    id,
    country: "united_states",
    visaType: "DS160",
    countryName: "United States",
    countryNameZh: "美国",
    countryFlag: "🇺🇸",
    visaTypeLabel: "DS-160",
    visaTypeLabelZh: "DS-160",
    status: "draft",
    packageId: null,
    packageName: null,
    updatedAt: null,
    createdAt: null,
  };
}

function photoRequirement(): DocumentRequirement {
  return {
    key: "photo",
    documentType: "photo",
    labelEn: "DS-160 photo",
    labelZh: "DS-160 照片",
    description: "A recent DS-160 photo.",
    required: true,
    sortOrder: 1,
    accept: [],
    source: "fallback",
  };
}

function dataFor(app: DocumentApplication): DocumentCenterData {
  return {
    applicantId: "applicant-1",
    applications: [app],
    selectedApplication: app,
    packageSummary: {
      id: null,
      name: "DS-160",
      description: null,
      country: app.country,
      visaType: app.visaType,
      source: "fallback",
    },
    requirements: [photoRequirement()],
    documents: [],
    ocrExtractions: [],
  };
}

function fileInput(): HTMLInputElement {
  const input = screen
    .getAllByLabelText("Choose DS-160 photo")
    .find((element): element is HTMLInputElement => element instanceof HTMLInputElement);
  if (!input) throw new Error("DS-160 photo input was not rendered");
  return input;
}

async function openCropDialog(app: DocumentApplication) {
  render(
    <DocumentCenterClient
      initialData={dataFor(app)}
      initialError={null}
      applicationId={app.id}
      embedded
    />,
  );

  fireEvent.change(fileInput(), {
    target: { files: [photoFile(buildJpegBytes(800, 600))] },
  });
  await waitFor(() => expect(screen.getByTestId("photo-crop-tool")).toBeInTheDocument());
}

describe("DS-160 document-center photo crop integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cropToolProps = null;
    mocks.uploadApplicationDocumentFromClient.mockResolvedValue({
      ok: true,
      storagePath: "application-1/photo/ds160-photo.jpg",
      filename: "ds160-photo.jpg",
    });
    mocks.loadDocumentCenterData.mockImplementation(async ({ applicationId }: { applicationId: string }) => ({
      ok: true,
      data: dataFor(application(applicationId)),
    }));
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:ds160-photo"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("opens the crop tool for a non-square JPEG without uploading it", async () => {
    await openCropDialog(application("application-1"));

    expect(screen.getByTestId("photo-crop-tool")).toBeInTheDocument();
    expect(mocks.cropToolProps?.imageObjectUrl).toBe("blob:ds160-photo");
    expect(mocks.uploadApplicationDocumentFromClient).not.toHaveBeenCalled();
  });

  it("does not upload when the crop dialog is cancelled", async () => {
    await openCropDialog(application("application-1"));

    fireEvent.click(screen.getByRole("button", { name: "Cancel crop" }));

    await waitFor(() => expect(screen.queryByTestId("photo-crop-tool")).not.toBeInTheDocument());
    expect(mocks.uploadApplicationDocumentFromClient).not.toHaveBeenCalled();
  });

  it("uploads a valid cropped JPEG to the selected application", async () => {
    const app = application("application-1");
    await openCropDialog(app);
    const cropProps = mocks.cropToolProps;
    expect(cropProps).not.toBeNull();

    await act(async () => {
      await cropProps?.onCropComplete(photoBlob(buildJpegBytes(600, 600)));
    });

    expect(mocks.uploadApplicationDocumentFromClient).toHaveBeenCalledTimes(1);
    const uploadForm = mocks.uploadApplicationDocumentFromClient.mock.calls[0]?.[0] as FormData;
    expect(uploadForm.get("applicationId")).toBe(app.id);
    expect(uploadForm.get("documentType")).toBe("photo");
    expect(uploadForm.get("requirementKey")).toBe("photo");
    expect(uploadForm.get("filename")).toBe("ds160-photo.jpg");
  });

  it("rejects an invalid cropped output without uploading it", async () => {
    await openCropDialog(application("application-1"));
    const cropProps = mocks.cropToolProps;
    expect(cropProps).not.toBeNull();

    await act(async () => {
      await cropProps?.onCropComplete(photoBlob(Uint8Array.from([1, 2, 3])));
    });

    expect(mocks.uploadApplicationDocumentFromClient).not.toHaveBeenCalled();
    expect(screen.getByText("Upload a JPEG (JPG) photo.")).toBeInTheDocument();
  });

  it("does not upload a crop callback from an application that has been replaced", async () => {
    const firstApplication = application("application-1");
    const secondApplication = application("application-2");
    const view = render(
      <DocumentCenterClient
        initialData={dataFor(firstApplication)}
        initialError={null}
        applicationId={firstApplication.id}
        embedded
      />,
    );

    fireEvent.change(fileInput(), {
      target: { files: [photoFile(buildJpegBytes(800, 600))] },
    });
    await waitFor(() => expect(screen.getByTestId("photo-crop-tool")).toBeInTheDocument());
    const staleCropProps = mocks.cropToolProps;
    expect(staleCropProps).not.toBeNull();

    view.rerender(
      <DocumentCenterClient
        initialData={dataFor(secondApplication)}
        initialError={null}
        applicationId={secondApplication.id}
        embedded
      />,
    );
    await waitFor(() => expect(mocks.loadDocumentCenterData).toHaveBeenCalledWith({
      applicationId: secondApplication.id,
      country: undefined,
      visaType: undefined,
    }));

    await act(async () => {
      await staleCropProps?.onCropComplete(photoBlob(buildJpegBytes(600, 600)));
    });

    expect(mocks.uploadApplicationDocumentFromClient).not.toHaveBeenCalled();
  });
});
