import { useCallback, useEffect, useRef, useState } from "react";

import { Service } from "@/api/types";
import { filetypeEnumToString } from "@/constants/filetypes";
import { RATINGS_SERVICES, ServiceType } from "@/constants/services";
import { useServices } from "@/store/servicesStore";

import StarRating from "../FileRating/StarRating";
import PushButton from "../PushButton/PushButton";

export interface TagSuggestionUIProps {
  addTag: (tag: string) => void;
  close: () => void;
}

function StrOperatorSelect({ ref }: { ref?: React.Ref<HTMLSelectElement> }) {
  return (
    <select ref={ref} className="system-tag-operator">
      <option value="=">equal to</option>
      <option value="!=">not equal to</option>
    </select>
  );
}

function NumOperatorSelect({ ref }: { ref?: React.Ref<HTMLSelectElement> }) {
  return (
    <select ref={ref} className="system-tag-operator">
      <option value="=">equal to</option>
      <option value="~=">approximately equal to</option>
      <option value="!=">not equal to</option>
      <option value="<">less than</option>
      <option value=">">greater than</option>
    </select>
  );
}

function LikeDislikeSelect({ ref }: { ref?: React.Ref<HTMLSelectElement> }) {
  return (
    <select ref={ref} className="system-tag-operator">
      <option value="like">like</option>
      <option value="dislike">dislike</option>
    </select>
  );
}

function ServicesSelect({
  selectedService,
  onSelectService,
}: {
  selectedService?: Service | undefined;
  onSelectService: (service: Service) => void;
}) {
  const services = Object.values(useServices()).filter((service) =>
    RATINGS_SERVICES.has(service.type),
  );

  useEffect(() => {
    if (!selectedService && services[0]) {
      onSelectService(services[0]);
    }
  }, [onSelectService, selectedService, services]);

  return (
    <select
      className="system-tag-operator"
      onChange={(e) => {
        const selected = services[e.currentTarget.selectedIndex];
        if (selected !== undefined) {
          onSelectService(selected);
        }
      }}
    >
      {services.map((service) => (
        <option
          value={service.service_key}
          key={service.service_key}
          selected={service === selectedService}
        >
          {service.name}
        </option>
      ))}
    </select>
  );
}

function FileTypeSelect({
  selectedFileType,
  onSelectFileType,
}: {
  selectedFileType?: string | undefined;
  onSelectFileType: (filetype: string) => void;
}) {
  const filetypes = Array.from(filetypeEnumToString.values());

  useEffect(() => {
    if (!selectedFileType && filetypes[0]) {
      onSelectFileType(filetypes[0]);
    }
  }, [onSelectFileType, selectedFileType, filetypes]);

  return (
    <select
      className="system-tag-operator"
      onChange={(e) => {
        const selected = filetypes[e.currentTarget.selectedIndex];
        if (selected !== undefined) {
          onSelectFileType(selected);
        }
      }}
    >
      {filetypes.map((filetype) => (
        <option
          value={filetype}
          key={filetype}
          selected={filetype === selectedFileType}
        >
          {filetype}
        </option>
      ))}
    </select>
  );
}

export function SimpleSystemTag({
  addTag,
  close,
  tag,
  min = 0,
  type,
}: TagSuggestionUIProps & {
  tag: string;
  min?: number;
  type: "numeric" | "text";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const operatorSelectRef = useRef<HTMLSelectElement>(null);

  const handleSubmit = useCallback(() => {
    if (!inputRef.current || !inputRef.current.value) {
      return;
    }

    if (type === "numeric") {
      if (operatorSelectRef.current && operatorSelectRef.current.value) {
        addTag(
          `system:${tag} ${operatorSelectRef.current.value} ${inputRef.current.value}`,
        );
      }
    } else {
      addTag(`system:${tag} ${inputRef.current.value}`);
    }
  }, [addTag, tag, type]);

  return (
    <div className="system-tag-form">
      {type === "numeric" && <NumOperatorSelect ref={operatorSelectRef} />}
      <input
        type={type === "numeric" ? "number" : "text"}
        autoFocus
        className={type === "numeric" ? "system-tag-number" : "system-tag-text"}
        placeholder={tag.slice(0, 1).toUpperCase() + tag.slice(1) + "..."}
        min={type === "numeric" ? min : undefined}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          }
        }}
        ref={inputRef}
      />
      <PushButton onClick={handleSubmit}>Add</PushButton>
      <PushButton onClick={close} variant="danger">
        Cancel
      </PushButton>
    </div>
  );
}

export function RatingSystemTag({ addTag, close }: TagSuggestionUIProps) {
  const [selectedService, setSelectedService] = useState<Service>();
  const [starValue, setStarValue] = useState<number | null>(null);
  const operatorSelectRef = useRef<HTMLSelectElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const serviceType =
    selectedService?.type === ServiceType.LOCAL_RATING_INCDEC
      ? "incdec"
      : selectedService?.type === ServiceType.LOCAL_RATING_LIKE ||
          selectedService?.type === ServiceType.RATING_LIKE_REPOSITORY
        ? "like"
        : selectedService?.type === ServiceType.LOCAL_RATING_NUMERICAL ||
            selectedService?.type === ServiceType.RATING_NUMERICAL_REPOSITORY
          ? "numeric"
          : null;

  // Reset star value when switching to other services.
  if (serviceType !== "numeric" && starValue !== null) {
    setStarValue(null);
  }

  const handleSubmit = useCallback(() => {
    if (!selectedService) {
      return;
    }
    let tagValue = "";
    if (serviceType === "numeric") {
      if (
        operatorSelectRef.current &&
        operatorSelectRef.current.value &&
        starValue !== null
      ) {
        tagValue = `system:rating for ${selectedService.name} is ${starValue}`;
      }
    } else if (serviceType === "like") {
      if (operatorSelectRef.current && operatorSelectRef.current.value) {
        tagValue = `system:rating for ${selectedService.name} is ${operatorSelectRef.current.value}`;
      }
    } else if (serviceType === "incdec" && inputRef.current) {
      if (operatorSelectRef.current && operatorSelectRef.current.value) {
        tagValue = `system:rating for ${selectedService.name} ${operatorSelectRef.current.value} ${inputRef.current.value}`;
      }
    }
    if (tagValue) {
      addTag(tagValue);
      close();
    }
  }, [addTag, close, selectedService, serviceType, starValue]);

  return (
    <div className="system-tag-form">
      <ServicesSelect
        selectedService={selectedService}
        onSelectService={setSelectedService}
      />
      {serviceType === "numeric" && selectedService && (
        <>
          <NumOperatorSelect ref={operatorSelectRef} />
          <StarRating
            maxStars={selectedService.max_stars ?? 5}
            starShape={selectedService.star_shape}
            value={starValue}
            onChange={setStarValue}
            readOnly={false}
          />
        </>
      )}
      {serviceType === "like" && selectedService && (
        <>
          <LikeDislikeSelect ref={operatorSelectRef} />
        </>
      )}
      {serviceType === "incdec" && (
        <>
          <NumOperatorSelect ref={operatorSelectRef} />
          <input
            type={"number"}
            autoFocus
            className={"system-tag-number"}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
            }}
            ref={inputRef}
          />
        </>
      )}
      <PushButton onClick={handleSubmit}>Add</PushButton>
      <PushButton onClick={close} variant="danger">
        Cancel
      </PushButton>
    </div>
  );
}

export function RatingServiceSystemTag({
  addTag,
  close,
  tag,
}: TagSuggestionUIProps & { tag: string }) {
  const [selectedService, setSelectedService] = useState<Service>();

  const handleSubmit = useCallback(() => {
    if (!selectedService) {
      return;
    }
    addTag(`system:${tag} ${selectedService.name}`);
  }, [addTag, selectedService, tag]);

  return (
    <div className="system-tag-form">
      <ServicesSelect
        selectedService={selectedService}
        onSelectService={setSelectedService}
      />
      <PushButton onClick={handleSubmit}>Add</PushButton>
      <PushButton onClick={close} variant="danger">
        Cancel
      </PushButton>
    </div>
  );
}

export function TagAsNumberTag({ addTag, close }: TagSuggestionUIProps) {
  const inputTagRef = useRef<HTMLInputElement>(null);
  const inputNumberRef = useRef<HTMLInputElement>(null);
  const operatorSelectRef = useRef<HTMLSelectElement>(null);

  const handleSubmit = useCallback(() => {
    if (
      !inputTagRef.current ||
      !inputTagRef.current.value ||
      !inputNumberRef.current ||
      !inputNumberRef.current.value ||
      !operatorSelectRef.current ||
      !operatorSelectRef.current.value
    ) {
      return;
    }

    if (operatorSelectRef.current && operatorSelectRef.current.value) {
      addTag(
        `system:tag as number ${inputTagRef.current.value} ${operatorSelectRef.current.value} ${inputNumberRef.current.value}`,
      );
    }
  }, [addTag]);

  return (
    <div className="system-tag-form">
      <input
        type="text"
        autoFocus
        className="system-tag-text"
        placeholder={"Namespace..."}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          }
        }}
        ref={inputTagRef}
      />
      <NumOperatorSelect ref={operatorSelectRef} />
      <input
        type="number"
        className="system-tag-number"
        placeholder={"Number..."}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          }
        }}
        ref={inputNumberRef}
      />
      <PushButton onClick={handleSubmit}>Add</PushButton>
      <PushButton onClick={close} variant="danger">
        Cancel
      </PushButton>
    </div>
  );
}

export function FileTypeSystemTag({
  addTag,
  close,
  tag,
}: TagSuggestionUIProps & { tag: string }) {
  const [selectedFileType, setSelectedFileType] = useState("");
  const operatorSelectRef = useRef<HTMLSelectElement>(null);

  const handleSubmit = useCallback(() => {
    if (!operatorSelectRef.current || !operatorSelectRef.current.value) {
      return;
    }

    if (operatorSelectRef.current && operatorSelectRef.current.value) {
      addTag(
        `system:${tag} ${operatorSelectRef.current.value} ${selectedFileType}`,
      );
    }
  }, [addTag, selectedFileType, tag]);

  return (
    <div className="system-tag-form">
      <StrOperatorSelect ref={operatorSelectRef} />
      <FileTypeSelect
        selectedFileType={selectedFileType}
        onSelectFileType={setSelectedFileType}
      />
      <PushButton onClick={handleSubmit}>Add</PushButton>
      <PushButton onClick={close} variant="danger">
        Cancel
      </PushButton>
    </div>
  );
}
