.PHONY: build-macos build-windows run

build-macos:
	npm run build:native:macos
build-windows:
	npm run build:native:windows
run:
	npm run dev