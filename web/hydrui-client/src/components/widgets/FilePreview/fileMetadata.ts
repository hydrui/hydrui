import { FileMetadata, Service } from "@/api/types";
import {
  REMOTE_FILE_SERVICES,
  SPECIFIC_LOCAL_FILE_SERVICES,
  ServiceType,
} from "@/constants/services";

export interface FileDomainInfo {
  serviceKey: string;
  name: string;
  type: ServiceType;
  timeImported?: number | undefined;
}

export function getFileDomains(
  fileData: FileMetadata,
  services: Record<string, Service>,
): FileDomainInfo[] {
  const current = fileData.file_services?.current;
  if (!current) {
    return [];
  }

  const localDomains: FileDomainInfo[] = [];
  const remoteDomains: FileDomainInfo[] = [];

  for (const [serviceKey, entry] of Object.entries(current)) {
    const service = services[serviceKey];
    if (!service) {
      continue;
    }
    const domain: FileDomainInfo = {
      serviceKey,
      name: service.name,
      type: service.type,
      timeImported: entry.time_imported ?? undefined,
    };
    if (SPECIFIC_LOCAL_FILE_SERVICES.has(service.type)) {
      localDomains.push(domain);
    } else if (REMOTE_FILE_SERVICES.has(service.type)) {
      remoteDomains.push(domain);
    }
  }

  localDomains.sort((a, b) => a.name.localeCompare(b.name));
  remoteDomains.sort((a, b) => a.name.localeCompare(b.name));

  return [...localDomains, ...remoteDomains];
}

export function getFileTimeImported(
  fileData: FileMetadata,
  services: Record<string, Service>,
): number | undefined {
  const current = fileData.file_services?.current;
  if (current) {
    let localMedia: number | undefined;
    let localFile: number | undefined;
    let earliest: number | undefined;

    for (const [serviceKey, entry] of Object.entries(current)) {
      const time = entry.time_imported;
      if (time == null) {
        continue;
      }
      const type = services[serviceKey]?.type;
      if (type === ServiceType.COMBINED_LOCAL_MEDIA) {
        localMedia = time;
      } else if (type === ServiceType.COMBINED_LOCAL_FILE) {
        localFile = time;
      }
      earliest = earliest === undefined ? time : Math.min(earliest, time);
    }

    if (localMedia !== undefined) {
      return localMedia;
    }
    if (localFile !== undefined) {
      return localFile;
    }
    if (earliest !== undefined) {
      return earliest;
    }
  }

  const deletedTimes = Object.values(fileData.file_services?.deleted ?? {})
    .map((entry) => entry.time_imported)
    .filter((time): time is number => time != null);
  return deletedTimes.length > 0 ? Math.min(...deletedTimes) : undefined;
}
