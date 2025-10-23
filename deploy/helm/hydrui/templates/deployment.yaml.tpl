apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "hydrui.fullname" . }}
  namespace: {{ include "hydrui.namespace" . }}
  labels:
    {{- include "hydrui.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.hydrui.replicaCount }}
  selector:
    matchLabels:
      {{- include "hydrui.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      annotations:
        checksum/secret: {{ include (print $.Template.BasePath "/secret.yaml.tpl") . | sha256sum }}
        {{- with .Values.hydrui.podAnnotations }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
      labels:
        {{- include "hydrui.selectorLabels" . | nindent 8 }}
    spec:
      {{- with .Values.hydrui.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      serviceAccountName: {{ include "hydrui.serviceAccountName" . }}
      {{- with .Values.hydrui.podSecurityContext }}
      securityContext:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      containers:
        - name: hydrui
          {{- with .Values.hydrui.securityContext }}
          securityContext:
            {{- toYaml . | nindent 12 }}
          {{- end }}
          image: {{ include "hydrui.image" . }}
          imagePullPolicy: {{ .Values.hydrui.image.pullPolicy }}
          args:
            - "-listen=:8080"
            - "-listen-internal=:5050"
            {{- if or (eq .Values.mode "server-bundled") (eq .Values.mode "server-external") }}
            - "-server-mode"
            {{- if .Values.serverMode.hydrus.url }}
            - "-hydrus-url={{ include "hydrui.hydrusUrl" . }}"
            {{- end }}
            {{- if not .Values.serverMode.security.secureCookies }}
            - "-secure=false"
            {{- end }}
            {{- if .Values.serverMode.auth.enabled }}
            - "-htpasswd=/secrets/htpasswd"
            {{- else }}
            - "-no-auth"
            {{- end }}
            {{- if .Values.serverMode.hydrus.secure }}
            - "-hydrus-secure"
            {{- end }}
            {{- if .Values.serverMode.acme.enabled }}
            - "-acme"
            {{- if .Values.serverMode.acme.email }}
            - "-acme-email={{ .Values.serverMode.acme.email }}"
            {{- end }}
            {{- if .Values.serverMode.acme.url }}
            - "-acme-url={{ .Values.serverMode.acme.url }}"
            {{- end }}
            {{- if .Values.serverMode.acme.storageDir }}
            - "-acme-dir={{ .Values.serverMode.acme.storageDir }}"
            {{- end }}
            {{- if .Values.serverMode.acme.hostMatch }}
            - "-acme-host-match={{ .Values.serverMode.acme.hostMatch }}"
            {{- end }}
            {{- end }}
            {{- end }}
            {{- with .Values.hydrui.extraArgs }}
            {{- toYaml . | nindent 12 }}
            {{- end }}
          ports:
            - name: http
              containerPort: 8080
              protocol: TCP
            - name: internal
              containerPort: 5050
              protocol: TCP
          env:
            {{- if or (eq .Values.mode "server-bundled") (eq .Values.mode "server-external") }}
            - name: HYDRUI_HYDRUS_API_KEY
              valueFrom:
                secretKeyRef:
                  name: {{ include "hydrui.hydrusApiKeySecretName" . }}
                  key: {{ include "hydrui.hydrusApiKeySecretKey" . }}
            - name: HYDRUI_SECRET
              valueFrom:
                secretKeyRef:
                  name: {{ include "hydrui.sessionSecretName" . }}
                  key: {{ include "hydrui.sessionSecretKey" . }}
            {{- end }}
            {{- with .Values.hydrui.extraEnv }}
            {{- toYaml . | nindent 12 }}
            {{- end }}
          {{- if or (eq .Values.mode "server-bundled") (eq .Values.mode "server-external") }}
          {{- $healthPath := "/healthz" }}
          {{- if .Values.serverMode.healthCheck.checkHydrus }}
          {{- $healthPath = "/healthz?check_hydrus" }}
          {{- end }}
          livenessProbe:
            httpGet:
              path: {{ $healthPath }}
              port: internal
              scheme: HTTP
            initialDelaySeconds: {{ .Values.hydrui.livenessProbe.initialDelaySeconds }}
            periodSeconds: {{ .Values.hydrui.livenessProbe.periodSeconds }}
            timeoutSeconds: {{ .Values.hydrui.livenessProbe.timeoutSeconds }}
            successThreshold: {{ .Values.hydrui.livenessProbe.successThreshold }}
            failureThreshold: {{ .Values.hydrui.livenessProbe.failureThreshold }}
          readinessProbe:
            httpGet:
              path: {{ $healthPath }}
              port: internal
              scheme: HTTP
            initialDelaySeconds: {{ .Values.hydrui.readinessProbe.initialDelaySeconds }}
            periodSeconds: {{ .Values.hydrui.readinessProbe.periodSeconds }}
            timeoutSeconds: {{ .Values.hydrui.readinessProbe.timeoutSeconds }}
            successThreshold: {{ .Values.hydrui.readinessProbe.successThreshold }}
            failureThreshold: {{ .Values.hydrui.readinessProbe.failureThreshold }}
          {{- else }}
          livenessProbe:
            httpGet:
              path: /healthz
              port: internal
              scheme: HTTP
            initialDelaySeconds: {{ .Values.hydrui.livenessProbe.initialDelaySeconds }}
            periodSeconds: {{ .Values.hydrui.livenessProbe.periodSeconds }}
            timeoutSeconds: {{ .Values.hydrui.livenessProbe.timeoutSeconds }}
            successThreshold: {{ .Values.hydrui.livenessProbe.successThreshold }}
            failureThreshold: {{ .Values.hydrui.livenessProbe.failureThreshold }}
          readinessProbe:
            httpGet:
              path: /healthz
              port: internal
              scheme: HTTP
            initialDelaySeconds: {{ .Values.hydrui.readinessProbe.initialDelaySeconds }}
            periodSeconds: {{ .Values.hydrui.readinessProbe.periodSeconds }}
            timeoutSeconds: {{ .Values.hydrui.readinessProbe.timeoutSeconds }}
            successThreshold: {{ .Values.hydrui.readinessProbe.successThreshold }}
            failureThreshold: {{ .Values.hydrui.readinessProbe.failureThreshold }}
          {{- end }}
          {{- with .Values.hydrui.resources }}
          resources:
            {{- toYaml . | nindent 12 }}
          {{- end }}
          volumeMounts:
            {{- if and (or (eq .Values.mode "server-bundled") (eq .Values.mode "server-external")) .Values.serverMode.auth.enabled }}
            - name: htpasswd
              mountPath: /secrets
              readOnly: true
            {{- end }}
            {{- if and (or (eq .Values.mode "server-bundled") (eq .Values.mode "server-external")) .Values.serverMode.acme.enabled }}
            - name: acme-storage
              mountPath: {{ .Values.serverMode.acme.storageDir }}
            {{- end }}
            {{- with .Values.hydrui.extraVolumeMounts }}
            {{- toYaml . | nindent 12 }}
            {{- end }}
      {{- with .Values.hydrui.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.hydrui.affinity }}
      affinity:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.hydrui.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      volumes:
        {{- if and (or (eq .Values.mode "server-bundled") (eq .Values.mode "server-external")) .Values.serverMode.auth.enabled }}
        - name: htpasswd
          secret:
            secretName: {{ include "hydrui.htpasswdSecretName" . }}
            items:
              - key: {{ include "hydrui.htpasswdSecretKey" . }}
                path: htpasswd
        {{- end }}
        {{- if and (or (eq .Values.mode "server-bundled") (eq .Values.mode "server-external")) .Values.serverMode.acme.enabled }}
        - name: acme-storage
          {{- if .Values.serverMode.acme.persistence.existingClaim }}
          persistentVolumeClaim:
            claimName: {{ .Values.serverMode.acme.persistence.existingClaim }}
          {{- else if .Values.serverMode.acme.persistence.enabled }}
          persistentVolumeClaim:
            claimName: {{ include "hydrui.fullname" . }}-acme
          {{- else }}
          emptyDir: {}
          {{- end }}
        {{- end }}
        {{- with .Values.hydrui.extraVolumes }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
