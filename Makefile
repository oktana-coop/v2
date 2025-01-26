MAKE_DIR := $(shell dirname $(realpath $(lastword $(MAKEFILE_LIST))))

.DEFAULT_GOAL := dev

.PHONY : install dev clean deep-clean preview compile build storybook build-storybook preview-storybook format lint test checks

install:
	pnpm install

dev: install
	pnpm run dev

clean:
	rm -rf dist/
	rm -rf storybook-static/

deep-clean: clean
	rm -rf ./node_modules
	rm -rf ./*lock*

preview: install
	pnpm run preview

compile:
	pnpm run compile

build: install compile
	pnpm run build

storybook: install
	pnpm run storybook

build-storybook: clean install
	pnpm run build-storybook

preview-storybook: install build-storybook
	serve $(MAKE_DIR)/storybook-static

format: 
	pnpm run lint --fix

lint: 
	pnpm run lint

test:
	pnpm run test

checks: install compile build lint test
	echo "✨ All checks are successful"
